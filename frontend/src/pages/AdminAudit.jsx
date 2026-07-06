import { useEffect, useState } from "react";
import { apiGet } from "../lib/api";

export default function AdminAudit() {
    const [auditLogs, setAuditLogs] = useState([]);
    const [message, setMessage] = useState("");

    const formatDate = (date) =>
    new Date(date).toLocaleString("en-SG", {
      dateStyle: "medium",
      timeStyle: "medium",
    });

    const loadData = async () => {
    try {
        const data = await apiGet("/admin/audit-logs");
        setAuditLogs(data || []);
    } catch {
        setMessage("Unable to load audit logs.");
    }
    };

    useEffect(() => {
    loadData();
    }, []);

    const actionLabels = {
    login: "User Login",
    logout: "User Logout",
    "admin.create_user": "User Created",
    "admin.list_pending_doctors": "Viewed Pending Doctor Registrations",
    "admin.approve_doctor": "Doctor Approved",
    "admin.reject_doctor": "Doctor Rejected",
    "rbac.inactive_denied": "Inactive Account Access Denied",
  };



    return (<div className="hn-page">
    <span className="hn-badge">Administrator console</span>

    <h1 style={{ margin: "1rem 0 0.5rem" }}>
      Audit Logs
    </h1>

    <p className="hn-text-muted">
      Review administrator actions and security events.
    </p>

    {message ? (
      <p
        className="hn-hint"
        style={{ color: "var(--hn-danger)" }}
      >
        {message}
      </p>
    ) : null}
    
    <div className="hn-card" style={{ marginTop: '1rem' }}>
        {auditLogs.length === 0 ? <p className="hn-text-muted">No audit events yet.</p> : (
          <ul style={{ paddingLeft: '1rem', lineHeight: 1.7 }}>
            {auditLogs.map((entry) => (
              <li key={entry.id}>
                <strong>{actionLabels[entry.action] || entry.action}</strong> — <span
                    style={{
                      color:
                        entry.result === "success"
                          ? "var(--hn-success)"
                          : "var(--hn-danger)",
                      fontWeight: 600,
                      textTransform: "uppercase",
                    }}
                  >
                    {entry.result}
                  </span> <br />
                {entry.target && (
                <div>
                  <strong>Target:</strong>{" "}
                  {entry.action === "logout"
                    ? `User ID ${entry.target}`
                    : entry.target}
                </div>
              )} • {formatDate(entry.created_at)}
              </li>
            ))}
          </ul>
        )}
      </div>
      </div>
    );
}