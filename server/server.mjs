import express from "express";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createSmartGymStore } from "../src/smartGymCore.mjs";

const publicRoot = join(fileURLToPath(new URL("..", import.meta.url)), "public");
const store = createSmartGymStore();
const app = express();
const port = Number(process.env.PORT || 5173);

app.use(express.json());
app.use(express.static(publicRoot));

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      const data = await handler(req, res);
      res.json({ ok: true, data });
    } catch (error) {
      next(error);
    }
  };
}

function currentUserId(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  return store.authUserId(token);
}

app.post("/api/register", asyncRoute((req) => store.register(req.body)));
app.post("/api/login", asyncRoute((req) => store.login(req.body)));
app.get("/api/me", asyncRoute((req) => store.userFromToken((req.headers.authorization || "").slice(7))));
app.get("/api/classes", asyncRoute(() => store.listClasses()));
app.post("/api/classes", asyncRoute((req) => store.createClass(currentUserId(req), req.body)));
app.put("/api/classes/:id", asyncRoute((req) => store.updateClass(currentUserId(req), req.params.id, req.body)));
app.post("/api/classes/:id/book", asyncRoute((req) => store.bookClass(currentUserId(req), req.params.id)));
app.post("/api/classes/:id/waitlist", asyncRoute((req) => store.joinWaitlist(currentUserId(req), req.params.id)));
app.post("/api/classes/:id/cancel", asyncRoute((req) => {
  return store.cancelClass(currentUserId(req), req.params.id, Boolean(req.body.simulateNotificationFailure));
}));
app.get("/api/bookings", asyncRoute((req) => store.listMyBookings(currentUserId(req))));
app.delete("/api/bookings/:id", asyncRoute((req) => store.cancelReservation(currentUserId(req), req.params.id)));
app.get("/api/reports/attendance", asyncRoute((req) => store.attendanceReport(currentUserId(req))));
app.get("/api/notifications", asyncRoute((req) => store.listNotifications(currentUserId(req))));

app.use((req, res) => {
  if (req.method !== "GET") {
    res.status(404).json({ ok: false, error: "Route not found." });
    return;
  }
  res.sendFile(join(publicRoot, "index.html"));
});

app.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(err.status || 500).json({
    ok: false,
    error: err.status ? err.message : "Unexpected server error."
  });
});

app.listen(port, () => {
  console.log(`SmartGym running at http://localhost:${port}`);
});
