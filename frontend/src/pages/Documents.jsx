import { useEffect, useMemo, useState } from 'react';
import { apiDownload, apiGet, apiPatch, apiPost, apiUploadRaw } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const CATEGORY_OPTIONS = [
  { value: 'general', label: 'General' },
  { value: 'lab', label: 'Lab Results' },
  { value: 'imaging', label: 'Imaging' },
  { value: 'prescription', label: 'Prescription' },
  { value: 'referral', label: 'Referral' },
];

const ROLE_COPY = {
  patient: {
    badge: 'Patient Records',
    title: 'My Medical Records',
    subtitle: 'View your stored health documents, manage access requests from healthcare staff, and keep important records ready when care teams need them.',
  },
  doctor: {
    badge: 'Clinical Access',
    title: 'Released Patient Documents',
    subtitle: 'Open only records that have already been released to your account and request access when additional patient documentation is clinically required.',
  },
  pharmacist: {
    badge: 'Clinical Access',
    title: 'Released Supporting Documents',
    subtitle: 'Access released supporting records relevant to dispensing and medication review, and monitor the outcome of your document requests.',
  },
  admin: {
    badge: 'Controlled Access',
    title: 'Document Access Requests',
    subtitle: 'Track your request activity and open only the records that have been explicitly released to your account.',
  },
};

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
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return 'N/A';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatCategory(category) {
  return category.replace(/^\w/, (char) => char.toUpperCase());
}

function safeRoleName(role) {
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Staff';
}

function getRequestAccessSummary(user, requests) {
  if (user.role === 'patient') {
    const pending = requests.filter((item) => item.status === 'pending').length;
    return pending === 0
      ? 'No pending access decisions right now.'
      : `${pending} access request${pending > 1 ? 's' : ''} awaiting your decision.`;
  }

  const approved = requests.filter((item) => item.status === 'approved').length;
  return approved === 0
    ? 'No records have been released to your account yet.'
    : `${approved} released record${approved > 1 ? 's are' : ' is'} currently available to you.`;
}

function SummaryCard({ label, value, hint }) {
  return (
    <div className="hn-card" style={{ padding: '1.1rem 1.25rem' }}>
      <div className="hn-text-muted" style={{ fontSize: '0.82rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '1.9rem', fontWeight: 700, marginTop: '0.2rem', color: 'var(--hn-primary-darker)' }}>{value}</div>
      <div className="hn-text-muted" style={{ marginTop: '0.2rem', fontSize: '0.88rem' }}>{hint}</div>
    </div>
  );
}

export default function Documents() {
  const { user } = useAuth();
  const roleCopy = ROLE_COPY[user.role] ?? ROLE_COPY.patient;
  const isPatient = user.role === 'patient';
  const canRequest = user.role === 'doctor' || user.role === 'pharmacist' || user.role === 'admin';

  const [documents, setDocuments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [uploadForm, setUploadForm] = useState({
    file: null,
    category: 'general',
    description: '',
  });
  const [requestForm, setRequestForm] = useState({
    documentId: '',
    reason: '',
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const pendingRequests = useMemo(
    () => requests.filter((item) => item.status === 'pending'),
    [requests],
  );

  const releasedRequests = useMemo(
    () => requests.filter((item) => item.status === 'approved'),
    [requests],
  );

  const sharedRecordsCount = useMemo(() => {
    const uniqueIds = new Set(requests.filter((item) => item.status === 'approved').map((item) => item.documentId));
    return uniqueIds.size;
  }, [requests]);

  const closedRequests = useMemo(
    () => requests.filter((item) => item.status !== 'pending'),
    [requests],
  );

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

  async function onCreateRequest(e) {
    e.preventDefault();
    if (!requestForm.documentId.trim()) {
      setError('Please enter the record ID you need access to.');
      return;
    }

    try {
      setBusy(true);
      setError('');
      setNotice('');
      await apiPost(`/documents/${requestForm.documentId.trim()}/requests`, {
        reason: requestForm.reason.trim() || undefined,
      });
      const requestedId = requestForm.documentId.trim();
      await refreshRequests();
      setRequestForm({ documentId: '', reason: '' });
      setNotice(`Access request submitted for record #${requestedId}.`);
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

  async function onOpenDocument(documentId) {
    try {
      setBusy(true);
      setError('');
      setNotice('');
      const document = await apiGet(`/documents/${documentId}`);
      setSelectedDocument(document);
      setNotice(`Record loaded.`);
    } catch (err) {
      setSelectedDocument(null);
      setError(err.message || 'Unable to open the selected record.');
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
      <span className="hn-badge">{roleCopy.badge}</span>
      <h1 style={{ margin: '1rem 0 0.25rem' }}>{roleCopy.title}</h1>
      <p className="hn-text-muted" style={{ marginTop: 0, maxWidth: '54rem' }}>
        {roleCopy.subtitle}
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

      {isPatient ? (
        <>
          <div className="hn-doc-summary-grid" style={{ marginTop: '1.5rem' }}>
            <SummaryCard label="Records" value={documents.length} hint="Stored in your account" />
            <SummaryCard label="Pending Requests" value={pendingRequests.length} hint="Awaiting your approval" />
            <SummaryCard label="Shared Records" value={sharedRecordsCount} hint="Currently released to staff" />
          </div>

          <div className="hn-doc-grid hn-doc-grid-patient" style={{ marginTop: '1.5rem' }}>
            <section className="hn-card">
              <h2 style={{ marginTop: 0 }}>My Records</h2>
              <p className="hn-text-muted" style={{ marginTop: '0.35rem' }}>
                View documents attached to your personal health record and open a document to see more details.
              </p>

              <div className="hn-table-wrap">
                <table className="hn-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Type</th>
                      <th>Date Added</th>
                      <th>Access Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => {
                      const isShared = requests.some((item) => item.documentId === doc.id && item.status === 'approved');
                      return (
                        <tr key={doc.id}>
                          <td>{doc.originalName}</td>
                          <td>{formatCategory(doc.category)}</td>
                          <td>{formatDate(doc.createdAt)}</td>
                          <td>{isShared ? 'Shared with care team' : 'Private to you'}</td>
                          <td>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <button type="button" className="hn-btn hn-btn-outline" onClick={() => setSelectedDocument(doc)}>
                                View
                              </button>
                              <button type="button" className="hn-btn hn-btn-primary" onClick={() => onDownload(doc.id)}>
                                Download
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {documents.length === 0 && (
                      <tr>
                        <td colSpan="5" className="hn-text-muted">No medical documents available.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="hn-card">
              <h2 style={{ marginTop: 0 }}>Pending Access Requests</h2>
              <p className="hn-text-muted" style={{ marginTop: '0.35rem' }}>
                Review new requests from healthcare staff before a document is shared outside your account.
              </p>

              {pendingRequests.length === 0 ? (
                <div className="hn-empty-state">
                  <strong>No pending decisions</strong>
                  <p className="hn-text-muted" style={{ margin: '0.5rem 0 0' }}>
                    There are currently no new access requests waiting for your approval.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '0.9rem' }}>
                  {pendingRequests.map((item) => (
                    <div key={item.id} className="hn-request-card">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'start' }}>
                        <div>
                          <strong>{safeRoleName(item.requestedRole)} request</strong>
                          <div className="hn-text-muted" style={{ marginTop: '0.25rem' }}>
                            Record #{item.documentId}
                          </div>
                        </div>
                        <StatusPill status={item.status} />
                      </div>
                      <p style={{ margin: '0.85rem 0 0.6rem' }}>{item.reason || 'No reason provided.'}</p>
                      <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <button type="button" className="hn-btn hn-btn-primary" onClick={() => onReviewRequest(item.id, 'approved')}>
                          Approve
                        </button>
                        <button type="button" className="hn-btn hn-btn-outline" onClick={() => onReviewRequest(item.id, 'denied')}>
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="hn-doc-grid hn-doc-grid-patient-secondary" style={{ marginTop: '1.5rem' }}>
            <section className="hn-card">
              <h2 style={{ marginTop: 0 }}>Document Details</h2>
              <p className="hn-text-muted" style={{ marginTop: '0.35rem' }}>
                Review the selected document before downloading or responding to related access requests.
              </p>

              {selectedDocument ? (
                <div className="hn-doc-detail-list">
                  <div><strong>Document name:</strong> {selectedDocument.originalName}</div>
                  <div><strong>Type:</strong> {formatCategory(selectedDocument.category)}</div>
                  <div><strong>Date added:</strong> {formatDateTime(selectedDocument.createdAt)}</div>
                  <div><strong>Status:</strong> <StatusPill status={selectedDocument.status} /></div>
                  <div><strong>File size:</strong> {selectedDocument.sizeBytes.toLocaleString()} bytes</div>
                  <div><strong>Notes:</strong> {selectedDocument.description || 'No notes provided.'}</div>

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
                    Choose one of your records to review its details.
                  </p>
                </div>
              )}
            </section>

            <section className="hn-card">
              <h2 style={{ marginTop: 0 }}>Add New Record</h2>
              <p className="hn-text-muted" style={{ marginTop: '0.35rem' }}>
                Upload a new document only when you want it stored in your patient record for future review.
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
          </div>

          <section className="hn-card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginTop: 0 }}>Previous Decisions</h2>
            <p className="hn-text-muted" style={{ marginTop: '0.35rem' }}>
              Review previous approvals and denials linked to your records.
            </p>

            <div className="hn-table-wrap">
              <table className="hn-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Requester</th>
                    <th>Status</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {closedRequests.map((item) => (
                    <tr key={item.id}>
                      <td>Record #{item.documentId}</td>
                      <td>{safeRoleName(item.requestedRole)}</td>
                      <td><StatusPill status={item.status} /></td>
                      <td>{item.reason || 'No reason recorded'}</td>
                    </tr>
                  ))}
                  {closedRequests.length === 0 && (
                    <tr>
                      <td colSpan="4" className="hn-text-muted">No previous decisions available.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="hn-doc-grid" style={{ marginTop: '1.5rem' }}>
            <section className="hn-card">
              <h2 style={{ marginTop: 0 }}>Request Record Access</h2>
              <p className="hn-text-muted" style={{ marginTop: '0.35rem' }}>
                Request access only for records required to support treatment, dispensing, or approved operational review.
              </p>

              <form onSubmit={onCreateRequest}>
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
                    <label className="hn-label" htmlFor="request-reason">Access reason</label>
                    <input
                      id="request-reason"
                      className="hn-input"
                      value={requestForm.reason}
                      onChange={(e) => setRequestForm((prev) => ({ ...prev, reason: e.target.value }))}
                      placeholder="State why this record is required"
                    />
                  </div>
                  <button type="submit" className="hn-btn hn-btn-primary" disabled={busy}>Submit request</button>
                </div>
              </form>
            </section>

            <section className="hn-card">
              <h2 style={{ marginTop: 0 }}>Released Records</h2>
              <p className="hn-text-muted" style={{ marginTop: '0.35rem' }}>
                {getRequestAccessSummary(user, requests)}
              </p>

              <div className="hn-table-wrap">
                <table className="hn-table">
                  <thead>
                    <tr>
                      <th>Record</th>
                      <th>Released To</th>
                      <th>Status</th>
                      <th>Reviewed</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {releasedRequests.map((item) => (
                      <tr key={item.id}>
                        <td>#{item.documentId}</td>
                        <td>{safeRoleName(item.requestedRole)}</td>
                        <td><StatusPill status={item.status} /></td>
                        <td>{formatDate(item.reviewedAt)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button type="button" className="hn-btn hn-btn-outline" onClick={() => onOpenDocument(item.documentId)}>
                              Open
                            </button>
                            <button type="button" className="hn-btn hn-btn-primary" onClick={() => onDownload(item.documentId)}>
                              Download
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {releasedRequests.length === 0 && (
                      <tr>
                        <td colSpan="5" className="hn-text-muted">No records have been released to your account.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </div>

          <div className="hn-doc-grid" style={{ marginTop: '1.5rem' }}>
            <section className="hn-card">
              <h2 style={{ marginTop: 0 }}>My Requests</h2>
              <p className="hn-text-muted" style={{ marginTop: '0.35rem' }}>
                Only requests submitted from your own account appear here.
              </p>

              <div className="hn-table-wrap">
                <table className="hn-table">
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Record</th>
                      <th>Submitted As</th>
                      <th>Status</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((item) => (
                      <tr key={item.id}>
                        <td>#{item.id}</td>
                        <td>#{item.documentId}</td>
                        <td>{safeRoleName(item.requestedRole)}</td>
                        <td><StatusPill status={item.status} /></td>
                        <td>{item.reason || 'No reason recorded'}</td>
                      </tr>
                    ))}
                    {requests.length === 0 && (
                      <tr>
                        <td colSpan="5" className="hn-text-muted">
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
                View metadata for a released record before downloading.
              </p>

              {selectedDocument ? (
                <div className="hn-doc-detail-list">
                  <div><strong>Document name:</strong> {selectedDocument.originalName}</div>
                  <div><strong>Type:</strong> {formatCategory(selectedDocument.category)}</div>
                  <div><strong>Date added:</strong> {formatDateTime(selectedDocument.createdAt)}</div>
                  <div><strong>Status:</strong> <StatusPill status={selectedDocument.status} /></div>
                  <div><strong>File size:</strong> {selectedDocument.sizeBytes.toLocaleString()} bytes</div>
                  <div><strong>Notes:</strong> {selectedDocument.description || 'No notes provided.'}</div>

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
                    Open one of your released records to review its details.
                  </p>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
