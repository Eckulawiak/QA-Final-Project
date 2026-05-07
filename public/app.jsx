const { useEffect, useMemo, useState } = React;

const api = async (path, options = {}) => {
  const token = localStorage.getItem("smartgym-token");
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const payload = await response.json();
  if (!payload.ok) throw new Error(payload.error);
  return payload.data;
};

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("schedule");
  const [classes, setClasses] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [reports, setReports] = useState([]);
  const [message, setMessage] = useState("");

  const refresh = async () => {
    setClasses(await api("/api/classes"));
    if (user?.role === "member") setBookings(await api("/api/bookings"));
    if (user) setNotifications(await api("/api/notifications"));
    if (user?.role === "staff")
      setReports(await api("/api/reports/attendance"));
  };

  useEffect(() => {
    const token = localStorage.getItem("smartgym-token");
    if (!token) return;
    api("/api/me")
      .then((nextUser) => nextUser && setUser(nextUser))
      .catch(() => localStorage.removeItem("smartgym-token"));
  }, []);

  useEffect(() => {
    refresh().catch((error) => setMessage(error.message));
  }, [user]);

  const act = async (label, work) => {
    try {
      await work();
      setMessage(label);
      await refresh();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const logout = () => {
    localStorage.removeItem("smartgym-token");
    setUser(null);
    setBookings([]);
    setReports([]);
    setNotifications([]);
    setMessage("");
  };

  if (!user)
    return (
      <AuthScreen setUser={setUser} setMessage={setMessage} message={message} />
    );

  return (
    <main>
      <header className="topbar">
        <div>
          <p className="eyebrow">SmartGym</p>
          <h1>Class Booking Console</h1>
        </div>
        <div className="account">
          <span>{user.name}</span>
          <strong>{user.role === "staff" ? "Gym Staff" : "Member"}</strong>
          <button onClick={logout}>Sign out</button>
        </div>
      </header>

      <nav className="tabs">
        <button
          className={view === "schedule" ? "active" : ""}
          onClick={() => setView("schedule")}
        >
          Schedule
        </button>
        {user.role === "member" && (
          <button
            className={view === "bookings" ? "active" : ""}
            onClick={() => setView("bookings")}
          >
            My Bookings
          </button>
        )}
        {user.role === "staff" && (
          <button
            className={view === "staff" ? "active" : ""}
            onClick={() => setView("staff")}
          >
            Staff Tools
          </button>
        )}
        {user.role === "staff" && (
          <button
            className={view === "reports" ? "active" : ""}
            onClick={() => setView("reports")}
          >
            Reports
          </button>
        )}
        <button
          className={view === "notifications" ? "active" : ""}
          onClick={() => setView("notifications")}
        >
          Notifications
        </button>
      </nav>

      {message && <div className="notice">{message}</div>}

      {view === "schedule" && (
        <Schedule user={user} classes={classes} act={act} />
      )}
      {view === "bookings" && <Bookings bookings={bookings} act={act} />}
      {view === "staff" && <StaffTools classes={classes} act={act} />}
      {view === "reports" && <Reports reports={reports} />}
      {view === "notifications" && (
        <Notifications notifications={notifications} />
      )}
    </main>
  );
}

function AuthScreen({ setUser, setMessage, message }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const submit = async (event) => {
    event.preventDefault();
    try {
      if (mode === "register")
        await api("/api/register", {
          method: "POST",
          body: JSON.stringify(form),
        });
      const session = await api("/api/login", {
        method: "POST",
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      localStorage.setItem("smartgym-token", session.token);
      setMessage("");
      setUser(session.user);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const fill = (email) => setForm({ name: "", email, password: "password123" });

  return (
    <main className="auth">
      <section className="authPanel">
        <p className="eyebrow">SER330 SmartGym</p>
        <h1>Reserve classes without overbooking the room.</h1>
        <div className="modeSwitch">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            Login
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            Register
          </button>
        </div>
        <form onSubmit={submit}>
          {mode === "register" && (
            <Field
              label="Name"
              value={form.name}
              onChange={(name) => setForm({ ...form, name })}
            />
          )}
          <Field
            label="Email"
            value={form.email}
            onChange={(email) => setForm({ ...form, email })}
          />
          <Field
            label="Password"
            type="password"
            value={form.password}
            onChange={(password) => setForm({ ...form, password })}
          />
          <button className="primary">
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <div className="quickLogins">
          <button onClick={() => fill("member@smartgym.test")}>
            Member demo
          </button>
          <button onClick={() => fill("staff@smartgym.test")}>
            Staff demo
          </button>
        </div>
        {message && <div className="notice">{message}</div>}
      </section>
    </main>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Schedule({ user, classes, act }) {
  if (classes.length === 0) return <Empty text="No classes available" />;
  return (
    <section className="grid">
      {classes.map((gymClass) => (
        <article className="classCard" key={gymClass.id}>
          <div className="classHead">
            <div>
              <h2>{gymClass.title}</h2>
              <p>
                {new Date(gymClass.startsAt).toLocaleString()} ·{" "}
                {gymClass.durationMinutes} min
              </p>
            </div>
            <span className={`pill ${gymClass.displayStatus.toLowerCase()}`}>
              {gymClass.displayStatus}
            </span>
          </div>
          <dl>
            <div>
              <dt>Instructor</dt>
              <dd>{gymClass.instructor}</dd>
            </div>
            <div>
              <dt>Room</dt>
              <dd>{gymClass.room}</dd>
            </div>
            <div>
              <dt>Capacity</dt>
              <dd>
                {gymClass.booked}/{gymClass.capacity}
              </dd>
            </div>
            <div>
              <dt>Waitlist</dt>
              <dd>{gymClass.waitlistCount}</dd>
            </div>
          </dl>
          {user.role === "member" && gymClass.status !== "cancelled" && (
            <div className="actions">
              <button
                disabled={gymClass.spotsLeft === 0}
                onClick={() =>
                  act("Reservation confirmed.", () =>
                    api(`/api/classes/${gymClass.id}/book`, { method: "POST" }),
                  )
                }
              >
                Book
              </button>
              <button
                disabled={gymClass.spotsLeft > 0}
                onClick={() =>
                  act("Added to waitlist.", () =>
                    api(`/api/classes/${gymClass.id}/waitlist`, {
                      method: "POST",
                    }),
                  )
                }
              >
                Waitlist
              </button>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

function Bookings({ bookings, act }) {
  if (bookings.length === 0)
    return <Empty text="No active booking history yet." />;
  return (
    <section className="tablePanel">
      <table>
        <thead>
          <tr>
            <th>Class</th>
            <th>Date</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id}>
              <td>{booking.gymClass.title}</td>
              <td>{new Date(booking.gymClass.startsAt).toLocaleString()}</td>
              <td>{booking.status}</td>
              <td>
                {booking.status === "confirmed" && (
                  <button
                    onClick={() =>
                      act("Reservation cancelled.", () =>
                        api(`/api/bookings/${booking.id}`, {
                          method: "DELETE",
                        }),
                      )
                    }
                  >
                    Cancel
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function StaffTools({ classes, act }) {
  const soon = new Date(Date.now() + 12 * 60 * 60 * 1000);
  const [form, setForm] = useState({
    title: "Pilates Core",
    instructor: "Taylor Kim",
    room: "Studio C",
    startsAt: soon.toISOString().slice(0, 16),
    durationMinutes: 45,
    capacity: 12,
  });

  const submit = (event) => {
    event.preventDefault();
    act("Class created.", () =>
      api("/api/classes", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          startsAt: new Date(form.startsAt).toISOString(),
        }),
      }),
    );
  };

  return (
    <section className="staffLayout">
      <form className="toolPanel" onSubmit={submit}>
        <h2>Create Class</h2>
        <Field
          label="Title"
          value={form.title}
          onChange={(title) => setForm({ ...form, title })}
        />
        <Field
          label="Instructor"
          value={form.instructor}
          onChange={(instructor) => setForm({ ...form, instructor })}
        />
        <Field
          label="Room"
          value={form.room}
          onChange={(room) => setForm({ ...form, room })}
        />
        <label>
          <span>Start</span>
          <input
            type="datetime-local"
            value={form.startsAt}
            onChange={(event) =>
              setForm({ ...form, startsAt: event.target.value })
            }
          />
        </label>
        <label>
          <span>Duration</span>
          <input
            type="number"
            value={form.durationMinutes}
            onChange={(event) =>
              setForm({ ...form, durationMinutes: Number(event.target.value) })
            }
          />
        </label>
        <label>
          <span>Capacity</span>
          <input
            type="number"
            value={form.capacity}
            onChange={(event) =>
              setForm({ ...form, capacity: Number(event.target.value) })
            }
          />
        </label>
        <button className="primary">Create</button>
      </form>
      <div className="toolPanel">
        <h2>Manage Schedule</h2>
        {classes.map((gymClass) => (
          <div className="manageRow" key={gymClass.id}>
            <span>{gymClass.title}</span>
            <button
              onClick={() =>
                act("Class cancelled and notifications sent.", () =>
                  api(`/api/classes/${gymClass.id}/cancel`, {
                    method: "POST",
                    body: JSON.stringify({
                      simulateNotificationFailure: false,
                    }),
                  }),
                )
              }
            >
              Cancel
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function Reports({ reports }) {
  if (reports.length === 0)
    return <Empty text="No attendance data available." />;
  return (
    <section className="tablePanel">
      <table>
        <thead>
          <tr>
            <th>Class</th>
            <th>Date</th>
            <th>Total Records</th>
            <th>Attended</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((row) => (
            <tr key={row.classId}>
              <td>{row.title}</td>
              <td>{new Date(row.date).toLocaleDateString()}</td>
              <td>{row.totalRecords}</td>
              <td>{row.attended}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function Notifications({ notifications }) {
  if (notifications.length === 0) return <Empty text="No notifications yet." />;
  return (
    <section className="notifications">
      {notifications.map((notification) => (
        <article key={notification.id} className="notification">
          <strong>{notification.type}</strong>
          <p>{notification.message}</p>
          <span>
            {notification.status} · attempts {notification.attempts}
          </span>
        </article>
      ))}
    </section>
  );
}

function Empty({ text }) {
  return <section className="empty">{text}</section>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
