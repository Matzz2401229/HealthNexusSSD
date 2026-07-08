import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch } from "../lib/api";

export default function AdminUsers() {
    const [users, setUsers] = useState([]);
    const [message, setMessage] = useState("");

    const loadData = async () => {
    try {
        const data = await apiGet("/admin/users");
        setUsers(data || []);
    } catch {
        setMessage("Unable to load users.");
    }
    };

    useEffect(() => {
    loadData();
    }, []);

    const toggleUserStatus = async (id, isActive) => {
    try {
        await apiPatch(`/admin/users/${id}/status`, { isActive: !isActive });
        setMessage('User status updated.');
        loadData();
        } catch (err) {
        setMessage(err.message || 'Unable to update user status.');
        }
    };
    const removeUser = async (id) => {
    if (!window.confirm('Remove this user account?')) {
        return;
    }

    try {
        await apiDelete(`/admin/users/${id}`);
        setMessage('User removed.');
        loadData();
    } catch (err) {
        setMessage(err.message || 'Unable to remove user.');
    }
    };



    return (
        <div className="hn-page">
        <span className="hn-badge">Administrator console</span>

        <div className="hn-card" style={{ marginTop: '1rem' }}>
            <h3 style={{ marginTop: 0 }}>Manage users</h3>
            {users.length === 0 ? <p className="hn-text-muted">No accounts found.</p> : (
            <ul style={{ paddingLeft: '1rem', lineHeight: 1.7 }}>
                {users.map((user) => (
                <li key={user.id}>
                    <strong>{user.email}</strong> — {user.role} — {user.is_active ? 'active' : 'inactive'}<br />
                    Created: {user.created_at}
                    <div style={{ marginTop: '0.35rem' }}>
                    <button className="hn-btn hn-btn-primary" onClick={() => toggleUserStatus(user.id, Boolean(user.is_active))}>
                        {user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button className="hn-btn" onClick={() => removeUser(user.id)} style={{ marginLeft: '0.5rem' }}>Remove</button>
                    </div>
                </li>
                ))}
            </ul>
            )}
        </div>
      </div>
    )
}