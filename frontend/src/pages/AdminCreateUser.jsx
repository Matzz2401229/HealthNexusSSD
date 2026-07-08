import { useState } from "react";
import { apiPost } from "../lib/api";

export default function AdminCreateUser() {

    const [message, setMessage] = useState("");

    const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "patient",
    dateOfBirth: "",
    specialty: "",
    pharmacy: "",
    });

    const createUser = async (e) => {
      e.preventDefault();

      try {
        const payload = {
          name: newUser.name,
          email: newUser.email,
          password: newUser.password,
          role: newUser.role,
        };

        if (newUser.role === "patient") {
          payload.dateOfBirth = newUser.dateOfBirth;
        }

        if (newUser.role === "doctor") {
          payload.specialty = newUser.specialty;
        }

        if (newUser.role === "pharmacist") {
          payload.pharmacy = newUser.pharmacy;
        }

        await apiPost("/admin/users", payload);

        setMessage('User created.');

        setNewUser({
          name: '',
          email: '',
          password: '',
          role: 'patient',
          dateOfBirth: '',
          specialty: '',
          pharmacy: '',
        });

        setMessage("User created successfully.");

      } catch (err) {
        setMessage(err.message || 'Unable to create user.');
      }
    };




  return (
  <div className="hn-page">
    <span className="hn-badge">Administrator console</span>

    <h1 style={{ margin: "1rem 0 0.5rem" }}>
      Create User
    </h1>

    <p className="hn-text-muted">
      Create new patient, doctor, pharmacist, or administrator accounts.
    </p>

    {message ? (
      <p
        className="hn-hint"
        style={{ color: "var(--hn-success)" }}
      >
        {message}
      </p>
    ) : null}

    <div className="hn-card" style={{ marginTop: "1rem" }}>
        <form onSubmit={createUser}>

    <div className="hn-field">
      <label>Name</label>
      <input
        className="hn-input"
        required
        value={newUser.name}
        onChange={(e) =>
          setNewUser({
            ...newUser,
            name: e.target.value,
          })
        }
      />
    </div>

    <div className="hn-field">
      <label>Email</label>
      <input
        className="hn-input"
        type="email"
        required
        value={newUser.email}
        onChange={(e) =>
          setNewUser({
            ...newUser,
            email: e.target.value,
          })
        }
      />
    </div>

    <div className="hn-field">
  <label>Password</label>

  <input
    className="hn-input"
    required
    type="password"
    value={newUser.password}
    onChange={(e) =>
      setNewUser({
        ...newUser,
        password: e.target.value,
      })
    }
  />

  <p className="hn-hint">
    Use 12+ characters with upper, lower, a digit, and a special character.
  </p>
</div>

    <div className="hn-field">
      <label>Role</label>

      <select
        className="hn-input"
        required
        value={newUser.role}
        onChange={(e) =>
          setNewUser({
            ...newUser,
            role: e.target.value,
          })
        }
      >
        <option value="patient">Patient</option>
        <option value="doctor">Doctor</option>
        <option value="pharmacist">Pharmacist</option>
        <option value="admin">Admin</option>
      </select>

    </div>

    {newUser.role === 'patient' && (
      <div className="hn-field">
        <label>Date of birth</label>

        <input
          className="hn-input"
          required
          type="date"
          value={newUser.dateOfBirth}
          onChange={(e) =>
            setNewUser({
              ...newUser,
              dateOfBirth: e.target.value,
            })
          }
        />
      </div>
    )}

    {newUser.role === 'doctor' && (
      <div className="hn-field">
        <label>Specialty</label>

        <input
          className="hn-input"
          required
          value={newUser.specialty}
          onChange={(e) =>
            setNewUser({
              ...newUser,
              specialty: e.target.value,
            })
          }
        />
      </div>
    )}

    {newUser.role === 'pharmacist' && (
      <div className="hn-field">
        <label>Pharmacy</label>

        <input
          className="hn-input"
          required
          value={newUser.pharmacy}
          onChange={(e) =>
            setNewUser({
              ...newUser,
              pharmacy: e.target.value,
            })
          }
        />
      </div>
    )}

    <button
      className="hn-btn hn-btn-primary"
      type="submit"
    >
      Create User
    </button>

  </form>
    </div>
    </div>
  );
}

