import { useEffect, useState } from 'react';
import { apiDownload, apiGet, apiPatch, apiPost, apiUploadRaw } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'lab', label: 'Lab Results' },
  { value: 'imaging', label: 'Imaging' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'referral', label: 'Referral' },
];

const STATUS_STYLE = {
  active: { color: 'var(--hn-success)', background: '#eaf8ef' },
  deleted: { color: 'var(--hn-danger)', background: '#fdecec' },
  quarantined: { color: 'var(--hn-warning)', background: '#fff8e1' },
  pending: { color: 'var(--hn-warning)', background: '#fff8e1' },
  approved: { color: 'var(--hn-success)', background: '#eaf8ef' },
  denied: { color: 'var(--hn-danger)', background: '#fdecec' },
  revoked: { color: '#7b8794', background: '#f3f5f7' },
};

function StatusPill({ status }) {
  const style = STATUS_STYLE[status] || STATUS_STYLE.pending;
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.2rem 0.55rem',
        borderRadius: '999px',
        fontSize: '0.78rem',
        fontWeight: 700,
        textTransform: 'capitalize',
        ...style,
      }}
    >
      {status}
    </span>
  );
}

function formatDate(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatCategory(category) {
  return category.replace(/^\w/, (char) => char.toUpperCase());
}

export default function Documents() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [lookupId, setLookupId] = useState('1');
  const [uploadForm, setUploadForm] = useState({
    file: null,
    category: 'general',
    description: '',
  });
  const [requestForm, setRequestForm] = useState({
    documentId: '1',
    reason: '',
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const isPatient = user.role === 'patient';
  const canRequest = user.role === 'doctor' || user.role === 'pharmacist' || user.role === 'admin';

  async function refreshDocuments() {
    if (!isPatient) return;
    const data = await apiGet('/documents');
    const items = data.items || [];
    setDocuments(items);
    if (items.length > 0 && !selectedDocument) {
      setSelectedDocument(items[0]);
    }
  }

  async function refreshRequests() {
    const data = await apiGet('/documents/requests');
    setRequests(data.items || []);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setBusy(true);
        setError('');
        const tasks = [refreshRequests()];
        if (isPatient) tasks.unshift(refreshDocuments());
        await Promise.all(tasks);
      } catch (err) {
        if (active) setError(err.message || 'Unable to load medical documents.');
      } finally {
        if (active) setBusy(false);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [isPatient]);

  async function onUpload(e) {
    e.preventDefault();
    if (!uploadForm.file) {
      setError('Please choose a PDF, PNG, or JPG file to upload.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      setNotice('');
      const created = await apiUploadRaw('/documents', uploadForm.file, {
        'x-file-name': uploadForm.file.name,
        'x-document-category': uploadForm.category,
        'x-document-description': uploadForm.description,
      });
      await refreshDocuments();
      setSelectedDocument(created);
      setUploadForm({ file: null, category: 'general', description: '' });
      const input = document.getElementById('document-upload-input');
      if (input) input.value = '';
      setNotice('Document uploaded successfully.');
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function onLookup(e) {
    e.preventDefault();
    if (!lookupId.trim()) return;

    try {
      setBusy(true);
      setError('');
      setNotice('');
      const data = await apiGet(`/documents/${lookupId.trim()}`);
      setSelectedDocument(data);
      setNotice(`Document #${lookupId.trim()} loaded.`);
    } catch (err) {
      setSelectedDocument(null);
      setError(err.message || 'Unable to load the selected document.');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateRequest(e) {
    e.preventDefault();
    if (!requestForm.documentId.trim()) return;

    try {
      setBusy(true);
      setError('');
      setNotice('');
      await apiPost(`/documents/${requestForm.documentId.trim()}/requests`, {
        reason: requestForm.reason.trim() || undefined,
      });
      await refreshRequests();
      setNotice(`Access request submitted for document #${requestForm.documentId.trim()}.`);
    } catch (err) {
      setError(err.message || 'Unable to submit the request.');
    } finally {
      setBusy(false);
    }
  }

  async function onReviewRequest(requestId, status) {
    try {
      setBusy(true);
      setError('');
      setNotice('');
      await apiPatch(`/documents/requests/${requestId}`, { status });
      await refreshRequests();
      setNotice(`Request #${requestId} updated to ${status}.`);
    } catch (err) {
      setError(err.message || 'Unable to update the request.');
    } finally {
      setBusy(false);
    }
  }

  async function onDownload(documentId) {
    try {
      setBusy(true);
      setError('');
      setNotice('');
      const file = await apiDownload(`/documents/${documentId}/download`);
      const url = window.URL.createObjectURL(file.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setNotice(`Downloading ${file.filename}.`);
    } catch (err) {
      setError(err.message || 'Download failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="hn-page">
      <span className="hn-badge">Medical Documents</span>
      <h1 style={{ margin: '1rem 0 0.25rem' }}>Medical Records & Documents</h1>
      <p className="hn-text-muted" style={{ marginTop: 0, maxWidth: '52rem' }}>
        Securely manage clinical records, upload supporting files, and control document access across care teams.
      </p>

      {error && (
        <div className="hn-card" style={{ borderColor: 'var(--hn-danger)', marginTop: '1rem', padding: '1rem 1.25rem' }}>
          <strong style={{ color: 'var(--hn-danger)' }}>Unable to complete request</strong>
          <p style={{ margin: '0.4rem 0 0' }}>{error}</p>
        </div>
      )}

      {notice && (
        <div className="hn-card" style={{ borderColor: 'var(--hn-success)', marginTop: '1rem', padding: '1rem 1.25rem' }}>
          <strong style={{ color: 'var(--hn-success)' }}>Update</strong>
          <p style={{ margin: '0.4rem 0 0' }}>{notice}</p>
        </div>
      )}

      <div className="hn-doc-grid" style={{ marginTop: '1.5rem' }}>
        {isPatient && (
          <section className="hn-card">
            <h2 style={{ marginTop: 0 }}>Upload Clinical Document</h2>
            <p className="hn-text-muted" style={{ marginTop: '0.35rem' }}>
              Add reports, scans, referrals, or supporting records to your health profile.
            </p>

            <form onSubmit={onUpload}>
              <div className="hn-field">
                <label className="hn-label" htmlFor="document-upload-input">Choose file</label>
                <input
                  id="document-upload-input"
                  className="hn-input"
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
                />
                <p className="hn-hint">Accepted formats: PDF, PNG, JPG, JPEG</p>
              </div>

              <div className="hn-field">
                <label className="hn-label" htmlFor="document-category">Document type</label>
                <select
                  id="document-category"
                  className="hn-select"
                  value={uploadForm.category}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, category: e.target.value }))}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="hn-field">
                <label className="hn-label" htmlFor="document-description">Notes</label>
                <input
                  id="document-description"
                  className="hn-input"
                  type="text"
                  placeholder="Add context for clinicians reviewing this file"
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <button type="submit" className="hn-btn hn-btn-primary" disabled={busy}>
                {busy ? 'Uploading…' : 'Upload document'}
              </button>
            </form>
          </section>
        )}

        <section className="hn-card">
          <h2 style={{ marginTop: 0 }}>{isPatient ? 'My Records' : 'Document Access'}</h2>
          <p className="hn-text-muted" style={{ marginTop: '0.35rem' }}>
            {isPatient
              ? 'Review records currently attached to your profile and open the full document details.'
              : 'Open a document by record ID and request access where needed.'}
          </p>

          {isPatient ? (
            <div className="hn-table-wrap">
              <table className="hn-table">
                <thead>
                  <tr>
                    <th>Record</th>
                    <th>Document Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id}>
                      <td>#{doc.id}</td>
                      <td>{doc.originalName}</td>
                      <td>{formatCategory(doc.category)}</td>
                      <td><StatusPill status={doc.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button type="button" className="hn-btn hn-btn-outline" onClick={() => setSelectedDocument(doc)}>
                            Open
                          </button>
                          <button type="button" className="hn-btn hn-btn-primary" onClick={() => onDownload(doc.id)}>
                            Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {documents.length === 0 && (
                    <tr>
                      <td colSpan="5" className="hn-text-muted">No medical documents available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <form onSubmit={onLookup} style={{ display: 'flex', gap: '0.75rem', alignItems: 'end', flexWrap: 'wrap' }}>
              <div className="hn-field" style={{ flex: '1 1 220px', marginBottom: 0 }}>
                <label className="hn-label" htmlFor="document-lookup">Record ID</label>
                <input
                  id="document-lookup"
                  className="hn-input"
                  value={lookupId}
                  onChange={(e) => setLookupId(e.target.value)}
                  placeholder="Enter a document record ID"
                />
              </div>
              <button type="submit" className="hn-btn hn-btn-primary" disabled={busy}>Open record</button>
            </form>
          )}
        </section>
      </div>

      <div className="hn-doc-grid" style={{ marginTop: '1.5rem' }}>
        <section className="hn-card">
          <h2 style={{ marginTop: 0 }}>{isPatient ? 'Access Requests' : 'My Requests'}</h2>
          <p className="hn-text-muted" style={{ marginTop: '0.35rem' }}>
            {isPatient
              ? 'Review requests from healthcare staff who need access to your uploaded records.'
              : 'Track current access requests for protected patient documents.'}
          </p>

          {canRequest && (
            <form onSubmit={onCreateRequest} style={{ marginBottom: '1.25rem' }}>
              <div className="hn-doc-request-form">
                <div className="hn-field" style={{ marginBottom: 0 }}>
                  <label className="hn-label" htmlFor="request-document-id">Record ID</label>
                  <input
                    id="request-document-id"
                    className="hn-input"
                    value={requestForm.documentId}
                    onChange={(e) => setRequestForm((prev) => ({ ...prev, documentId: e.target.value }))}
                  />
                </div>
                <div className="hn-field" style={{ marginBottom: 0 }}>
                  <label className="hn-label" htmlFor="request-reason">Clinical reason</label>
                  <input
                    id="request-reason"
                    className="hn-input"
                    value={requestForm.reason}
                    onChange={(e) => setRequestForm((prev) => ({ ...prev, reason: e.target.value }))}
                    placeholder="State the reason access is required"
                  />
                </div>
                <button type="submit" className="hn-btn hn-btn-outline" disabled={busy}>Request access</button>
              </div>
            </form>
          )}

          <div className="hn-table-wrap">
            <table className="hn-table">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Record</th>
                  <th>Requester</th>
                  <th>Status</th>
                  <th>Reason</th>
                  {isPatient && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {requests.map((item) => (
                  <tr key={item.id}>
                    <td>#{item.id}</td>
                    <td>#{item.documentId}</td>
                    <td>#{item.requesterId}{item.requestedRole ? ` (${item.requestedRole})` : ''}</td>
                    <td><StatusPill status={item.status} /></td>
                    <td>{item.reason || 'No reason recorded'}</td>
                    {isPatient && (
                      <td>
                        {item.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button type="button" className="hn-btn hn-btn-primary" onClick={() => onReviewRequest(item.id, 'approved')}>
                              Approve
                            </button>
                            <button type="button" className="hn-btn hn-btn-outline" onClick={() => onReviewRequest(item.id, 'denied')}>
                              Deny
                            </button>
                          </div>
                        ) : (
                          <span className="hn-text-muted">Closed</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={isPatient ? 6 : 5} className="hn-text-muted">
                      {busy ? 'Loading requests…' : 'No requests available.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="hn-card">
          <h2 style={{ marginTop: 0 }}>Document Details</h2>
          <p className="hn-text-muted" style={{ marginTop: '0.35rem' }}>
            Review document metadata, access status, and record history before downloading.
          </p>

          {selectedDocument ? (
            <div className="hn-doc-detail-list">
              <div><strong>Record ID:</strong> #{selectedDocument.id}</div>
              <div><strong>Document name:</strong> {selectedDocument.originalName}</div>
              <div><strong>Patient ID:</strong> #{selectedDocument.patientId}</div>
              <div><strong>Uploaded by:</strong> #{selectedDocument.uploadedBy}</div>
              <div><strong>Category:</strong> {formatCategory(selectedDocument.category)}</div>
              <div><strong>Current status:</strong> <StatusPill status={selectedDocument.status} /></div>
              <div><strong>File size:</strong> {selectedDocument.sizeBytes.toLocaleString()} bytes</div>
              <div><strong>Date added:</strong> {formatDate(selectedDocument.createdAt)}</div>
              <div><strong>Last updated:</strong> {formatDate(selectedDocument.updatedAt)}</div>
              <div><strong>Clinical notes:</strong> {selectedDocument.description || 'No notes provided.'}</div>

              <div style={{ marginTop: '1rem' }}>
                <button type="button" className="hn-btn hn-btn-primary" onClick={() => onDownload(selectedDocument.id)}>
                  Download document
                </button>
              </div>
            </div>
          ) : (
            <div className="hn-empty-state">
              <strong>No document selected</strong>
              <p className="hn-text-muted" style={{ margin: '0.5rem 0 0' }}>
                Select a record from the list or open a document by record ID to view more information.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
