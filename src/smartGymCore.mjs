const HOUR = 60 * 60 * 1000;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000;

export function createSmartGymStore(now = () => Date.now()) {
  const state = {
    users: [],
    classes: [],
    bookings: [],
    notifications: [],
    attendance: [],
    sessions: new Map(),
    loginFailures: new Map(),
    nextUserId: 1,
    nextClassId: 1,
    nextBookingId: 1,
    nextNotificationId: 1
  };

  const seed = () => {
    state.users = [
      { id: 1, name: "Jordan Member", email: "member@smartgym.test", password: "password123", role: "member" },
      { id: 2, name: "Casey Member", email: "casey@smartgym.test", password: "password123", role: "member" },
      { id: 3, name: "Riley Staff", email: "staff@smartgym.test", password: "password123", role: "staff" }
    ];
    state.classes = [
      {
        id: 1,
        title: "Morning Strength",
        instructor: "Avery Lee",
        room: "Studio A",
        startsAt: new Date(now() + 4 * HOUR).toISOString(),
        durationMinutes: 45,
        capacity: 2,
        status: "scheduled",
        waitlist: []
      },
      {
        id: 2,
        title: "Spin Express",
        instructor: "Morgan Patel",
        room: "Studio B",
        startsAt: new Date(now() + 8 * HOUR).toISOString(),
        durationMinutes: 30,
        capacity: 1,
        status: "scheduled",
        waitlist: [2]
      },
      {
        id: 3,
        title: "Weekend Yoga",
        instructor: "Sam Rivera",
        room: "Studio A",
        startsAt: new Date(now() + 28 * HOUR).toISOString(),
        durationMinutes: 60,
        capacity: 20,
        status: "scheduled",
        waitlist: []
      }
    ];
    state.bookings = [
      { id: 1, userId: 1, classId: 2, status: "confirmed", createdAt: new Date(now()).toISOString() }
    ];
    state.attendance = [
      { classId: 2, userId: 1, attended: true },
      { classId: 3, userId: 1, attended: true },
      { classId: 3, userId: 2, attended: false }
    ];
    state.notifications = [];
    state.sessions = new Map();
    state.loginFailures = new Map();
    state.nextUserId = 4;
    state.nextClassId = 4;
    state.nextBookingId = 2;
    state.nextNotificationId = 1;
  };

  const publicUser = (user) => user && ({ id: user.id, name: user.name, email: user.email, role: user.role });
  const findUser = (id) => state.users.find((user) => user.id === id);
  const requireUser = (userId) => {
    const user = findUser(userId);
    if (!user) throw problem(401, "Authentication required.");
    return user;
  };
  const requireStaff = (userId) => {
    const user = requireUser(userId);
    if (user.role !== "staff") throw problem(403, "Access denied. Gym staff only.");
    return user;
  };
  const requireMember = (userId) => {
    const user = requireUser(userId);
    if (user.role !== "member") throw problem(403, "Access denied. Members only.");
    return user;
  };
  const getClass = (classId) => {
    const gymClass = state.classes.find((item) => item.id === Number(classId));
    if (!gymClass) throw problem(404, "Class not found.");
    return gymClass;
  };
  const confirmedBookings = (classId) => state.bookings.filter((booking) => booking.classId === classId && booking.status === "confirmed");
  const activeBooking = (classId, userId) =>
    state.bookings.find((booking) => booking.classId === classId && booking.userId === userId && booking.status === "confirmed");
  const classEnd = (gymClass) => new Date(gymClass.startsAt).getTime() + gymClass.durationMinutes * 60 * 1000;
  const hasRoomOverlap = (candidate, ignoredClassId = null) =>
    state.classes.some((existing) => {
      if (existing.id === ignoredClassId || existing.status === "cancelled" || existing.room !== candidate.room) return false;
      const start = new Date(candidate.startsAt).getTime();
      const end = start + candidate.durationMinutes * 60 * 1000;
      const existingStart = new Date(existing.startsAt).getTime();
      const existingEnd = classEnd(existing);
      return start < existingEnd && end > existingStart;
    });

  function problem(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
  }

  function validateClassInput(input) {
    const title = String(input.title || "").trim();
    const instructor = String(input.instructor || "").trim();
    const room = String(input.room || "").trim();
    const startsAt = input.startsAt;
    const durationMinutes = Number(input.durationMinutes || 45);
    const capacity = Number(input.capacity);
    if (!title || !instructor || !room || !startsAt) throw problem(400, "Title, instructor, room, and start time are required.");
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) throw problem(400, "Class capacity must be between 1 and 50.");
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 180) throw problem(400, "Duration must be between 15 and 180 minutes.");
    if (new Date(startsAt).getTime() <= now()) throw problem(400, "Class must be scheduled in the future.");
    return { title, instructor, room, startsAt: new Date(startsAt).toISOString(), durationMinutes, capacity };
  }

  function decorateClass(gymClass) {
    const booked = confirmedBookings(gymClass.id).length;
    const spotsLeft = Math.max(gymClass.capacity - booked, 0);
    return {
      ...gymClass,
      booked,
      spotsLeft,
      waitlistCount: gymClass.waitlist.length,
      displayStatus: gymClass.status === "cancelled" ? "Cancelled" : spotsLeft === 0 ? "Full" : "Open"
    };
  }

  function notify(userId, type, message, attempts = 1) {
    const notification = {
      id: state.nextNotificationId++,
      userId,
      type,
      message,
      attempts,
      status: attempts > 3 ? "failed" : "sent",
      createdAt: new Date(now()).toISOString()
    };
    state.notifications.unshift(notification);
    return notification;
  }

  function register({ name, email, password, role = "member" }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    if (!name || !normalizedEmail || !password) throw problem(400, "Name, email, and password are required.");
    if (role !== "member") throw problem(403, "Only member self-registration is allowed.");
    if (password.length < 8) throw problem(400, "Password must be at least 8 characters.");
    if (state.users.some((user) => user.email === normalizedEmail)) throw problem(409, "Email already exists.");
    const user = { id: state.nextUserId++, name: String(name).trim(), email: normalizedEmail, password, role };
    state.users.push(user);
    return publicUser(user);
  }

  function login({ email, password }) {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const failure = state.loginFailures.get(normalizedEmail);
    if (failure?.lockedUntil && failure.lockedUntil > now()) throw problem(423, "Account temporarily locked for 15 minutes.");
    const user = state.users.find((candidate) => candidate.email === normalizedEmail && candidate.password === password);
    if (!user) {
      const next = { count: (failure?.count || 0) + 1, lockedUntil: 0 };
      if (next.count >= 5) next.lockedUntil = now() + LOCKOUT_WINDOW_MS;
      state.loginFailures.set(normalizedEmail, next);
      throw problem(next.lockedUntil ? 423 : 401, next.lockedUntil ? "Account temporarily locked for 15 minutes." : "Invalid email or password.");
    }
    state.loginFailures.delete(normalizedEmail);
    const token = `token-${user.id}-${Math.random().toString(36).slice(2)}`;
    state.sessions.set(token, user.id);
    return { token, user: publicUser(user) };
  }

  function userFromToken(token) {
    const userId = state.sessions.get(token);
    return publicUser(findUser(userId));
  }

  function listClasses() {
    return state.classes
      .filter((gymClass) => new Date(gymClass.startsAt).getTime() > now())
      .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
      .map(decorateClass);
  }

  function createClass(userId, input) {
    requireStaff(userId);
    const validated = validateClassInput(input);
    if (hasRoomOverlap(validated)) throw problem(409, "Schedule overlaps with another class in the same room.");
    const gymClass = { id: state.nextClassId++, ...validated, status: "scheduled", waitlist: [] };
    state.classes.push(gymClass);
    return decorateClass(gymClass);
  }

  function updateClass(userId, classId, input) {
    requireStaff(userId);
    const gymClass = getClass(classId);
    const validated = validateClassInput({ ...gymClass, ...input });
    if (hasRoomOverlap(validated, gymClass.id)) throw problem(409, "Schedule overlaps with another class in the same room.");
    Object.assign(gymClass, validated);
    return decorateClass(gymClass);
  }

  function bookClass(userId, classId) {
    requireMember(userId);
    const gymClass = getClass(classId);
    if (gymClass.status === "cancelled") throw problem(409, "Cannot book a cancelled class.");
    if (activeBooking(gymClass.id, userId)) throw problem(409, "Duplicate reservation prevented.");
    if (gymClass.waitlist.includes(userId)) throw problem(409, "Member is already on the waitlist.");
    if (confirmedBookings(gymClass.id).length >= gymClass.capacity) {
      throw problem(409, "Class is full. Join the waitlist to be notified if a spot opens.");
    }
    const booking = { id: state.nextBookingId++, userId, classId: gymClass.id, status: "confirmed", createdAt: new Date(now()).toISOString() };
    state.bookings.push(booking);
    notify(userId, "booking-confirmed", `Your reservation for ${gymClass.title} is confirmed.`);
    return { booking, gymClass: decorateClass(gymClass) };
  }

  function joinWaitlist(userId, classId) {
    requireMember(userId);
    const gymClass = getClass(classId);
    if (gymClass.status === "cancelled") throw problem(409, "Cannot join a waitlist for a cancelled class.");
    if (activeBooking(gymClass.id, userId)) throw problem(409, "Member already has a reservation.");
    if (gymClass.waitlist.includes(userId)) throw problem(409, "Member is already on the waitlist.");
    if (confirmedBookings(gymClass.id).length < gymClass.capacity) throw problem(409, "Class has open spots. Book directly instead.");
    gymClass.waitlist.push(userId);
    notify(userId, "waitlisted", `You joined the waitlist for ${gymClass.title}.`);
    return decorateClass(gymClass);
  }

  function cancelReservation(userId, bookingId) {
    requireMember(userId);
    const booking = state.bookings.find((item) => item.id === Number(bookingId) && item.userId === userId && item.status === "confirmed");
    if (!booking) throw problem(404, "Reservation not found.");
    const gymClass = getClass(booking.classId);
    if (new Date(gymClass.startsAt).getTime() - now() < HOUR) throw problem(409, "Reservations must be cancelled at least 1 hour before class start time.");
    booking.status = "cancelled";
    notify(userId, "booking-cancelled", `Your reservation for ${gymClass.title} was cancelled.`);
    promoteWaitlist(gymClass);
    return { booking, gymClass: decorateClass(gymClass) };
  }

  function promoteWaitlist(gymClass) {
    if (confirmedBookings(gymClass.id).length >= gymClass.capacity || gymClass.waitlist.length === 0) return null;
    const nextUserId = gymClass.waitlist.shift();
    const booking = { id: state.nextBookingId++, userId: nextUserId, classId: gymClass.id, status: "confirmed", createdAt: new Date(now()).toISOString() };
    state.bookings.push(booking);
    notify(nextUserId, "waitlist-promoted", `A spot opened for ${gymClass.title}; your reservation is confirmed.`);
    return booking;
  }

  function cancelClass(userId, classId, simulateNotificationFailure = false) {
    requireStaff(userId);
    const gymClass = getClass(classId);
    if (gymClass.status === "cancelled") throw problem(409, "Class is already cancelled.");
    gymClass.status = "cancelled";
    const affectedUserIds = [...new Set(confirmedBookings(gymClass.id).map((booking) => booking.userId).concat(gymClass.waitlist))];
    for (const affectedUserId of affectedUserIds) {
      notify(
        affectedUserId,
        "class-cancelled",
        `${gymClass.title} was cancelled.`,
        simulateNotificationFailure ? 4 : 1
      );
    }
    return { gymClass: decorateClass(gymClass), affectedUserIds };
  }

  function listMyBookings(userId) {
    requireMember(userId);
    return state.bookings
      .filter((booking) => booking.userId === userId)
      .map((booking) => ({ ...booking, gymClass: decorateClass(getClass(booking.classId)) }))
      .sort((a, b) => new Date(a.gymClass.startsAt) - new Date(b.gymClass.startsAt));
  }

  function attendanceReport(userId) {
    requireStaff(userId);
    if (state.attendance.length === 0) return [];
    return state.classes.map((gymClass) => {
      const rows = state.attendance.filter((row) => row.classId === gymClass.id);
      return {
        classId: gymClass.id,
        title: gymClass.title,
        date: gymClass.startsAt,
        totalRecords: rows.length,
        attended: rows.filter((row) => row.attended).length
      };
    }).filter((row) => row.totalRecords > 0);
  }

  function listNotifications(userId) {
    requireUser(userId);
    return state.notifications.filter((notification) => notification.userId === userId || findUser(userId).role === "staff");
  }

  function authUserId(token) {
    const userId = state.sessions.get(token);
    if (!userId) throw problem(401, "Authentication required.");
    return userId;
  }

  seed();

  return {
    state,
    seed,
    register,
    login,
    userFromToken,
    authUserId,
    listClasses,
    createClass,
    updateClass,
    bookClass,
    joinWaitlist,
    cancelReservation,
    cancelClass,
    listMyBookings,
    attendanceReport,
    listNotifications
  };
}
