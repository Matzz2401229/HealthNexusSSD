import { useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "../lib/api";

export default function AdminAnnouncements() {
    const [announcements, setAnnouncements] = useState([]);
    const [title, setTitle] = useState("");
    const [body, setBody] = useState("");
    const [message, setMessage] = useState("");
    const [editingId, setEditingId] = useState(null);

    const loadData = async () => {
    try {
        const data = await apiGet("/admin/announcements");
        setAnnouncements(data || []);
    } catch {
        setMessage("Unable to load announcements.");
    }
    };

    useEffect(() => {
    loadData();
    }, []);

    const publishAnnouncement = async (e) => {
      e.preventDefault();

      try {
        if (editingId) {
          await apiPatch(`/admin/announcements/${editingId}`, { title, body });
          setMessage("Announcement updated.");
        } else {
          await apiPost('/admin/announcements', { title, body });
          setMessage("Announcement published.");
        }

        setTitle('');
        setBody('');
        setEditingId(null);
        loadData();
      } catch (err) {
        setMessage(err.message || 'Unable to save announcement.');
      }
    };



    return ( <div className="hn-page">
    <span className="hn-badge">Administrator console</span>
    <div className="hn-card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Create announcement</h3>
        <form onSubmit={publishAnnouncement}>
          <div className="hn-field">
            <label className="hn-label">Title</label>
            <input className="hn-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>
          <div className="hn-field">
            <label className="hn-label">Body</label>
            <textarea className="hn-input" rows="4" value={body} onChange={(e) => setBody(e.target.value)} required />
          </div>
          <button className="hn-btn hn-btn-primary" type="submit">{editingId ? "Update" : "Publish"}</button>
          {editingId && (
            <button
              type="button"
              className="hn-btn"
              onClick={() => {
                setEditingId(null);
                setTitle("");
                setBody("");
              }}
            >
              Cancel Edit
            </button>
          )}
        </form>
      </div>

      <div className="hn-card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Announcements</h3>
        {announcements.length === 0 ? <p className="hn-text-muted">No announcements yet.</p> : (
          <ul style={{ paddingLeft: '1rem', lineHeight: 1.7 }}>
            {announcements.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong><br />
                {item.body}<br />
                <span className="hn-text-muted">{item.created_at}</span>

                <div style={{ marginTop: "0.5rem" }}>
                  <button
                    className="hn-btn"
                    onClick={() => {
                      setEditingId(item.id);
                      setTitle(item.title);
                      setBody(item.body);
                    }}
                  >
                    Edit
                  </button>
                
                  <button
                    className="hn-btn"
                    style={{ marginLeft: "0.5rem", color: "red" }}
                    onClick={async () => {
                      if (!confirm("Are you sure you want to delete this announcement?")) return;

                      try {
                        await apiDelete(`/admin/announcements/${item.id}`);
                        setMessage("Announcement deleted.");
                        loadData();
                      } catch (err) {
                        setMessage(err.message || "Failed to delete announcement.");
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    );
}