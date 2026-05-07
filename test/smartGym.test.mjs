import { createSmartGymStore } from "../src/smartGymCore.mjs";

const baseNow = Date.parse("2026-05-07T14:00:00.000Z");

const memberId = 1;
const secondMemberId = 2;
const staffId = 3;

describe("SmartGym requirements", () => {
  test("creates a member account with a unique email and rejects duplicate email", () => {
    const store = createSmartGymStore(() => baseNow);

    const user = store.register({
      name: "New Member",
      email: "new@smartgym.test",
      password: "password123",
    });

    expect(user.role).toBe("member");

    expect(() =>
      store.register({
        name: "Copy",
        email: "new@smartgym.test",
        password: "password123",
      }),
    ).toThrow(/Email already exists/);
  });

  test("rejects passwords shorter than 8 characters", () => {
    const store = createSmartGymStore(() => baseNow);

    expect(() =>
      store.register({
        name: "Short Password",
        email: "short@smartgym.test",
        password: "short",
      }),
    ).toThrow(/at least 8/);
  });

  test("locks an account after five failed login attempts", () => {
    const store = createSmartGymStore(() => baseNow);

    for (let count = 0; count < 4; count++) {
      expect(() =>
        store.login({
          email: "member@smartgym.test",
          password: "wrong",
        }),
      ).toThrow(/Invalid/);
    }

    expect(() =>
      store.login({
        email: "member@smartgym.test",
        password: "wrong",
      }),
    ).toThrow(/locked/);

    expect(() =>
      store.login({
        email: "member@smartgym.test",
        password: "password123",
      }),
    ).toThrow(/locked/);
  });

  test("prevents non-staff users from creating classes", () => {
    const store = createSmartGymStore(() => baseNow);

    expect(() => store.createClass(memberId, futureClass())).toThrow(
      /Gym staff only/,
    );
  });

  test("enforces class capacity boundaries from 1 to 50", () => {
    const store = createSmartGymStore(() => baseNow);

    expect(() =>
      store.createClass(staffId, futureClass({ capacity: 0 })),
    ).toThrow(/between 1 and 50/);

    expect(
      store.createClass(staffId, futureClass({ capacity: 1 })).capacity,
    ).toBe(1);

    expect(
      store.createClass(
        staffId,
        futureClass({
          title: "Boundary 50",
          room: "Studio Z",
          capacity: 50,
        }),
      ).capacity,
    ).toBe(50);

    expect(() =>
      store.createClass(staffId, futureClass({ capacity: 51 })),
    ).toThrow(/between 1 and 50/);
  });

  test("rejects overlapping classes in the same room", () => {
    const store = createSmartGymStore(() => baseNow);

    const existing = store.listClasses()[0];

    expect(() =>
      store.createClass(
        staffId,
        futureClass({
          startsAt: existing.startsAt,
          room: existing.room,
        }),
      ),
    ).toThrow(/overlaps/);
  });

  test("books an available spot and prevents duplicate reservations", () => {
    const store = createSmartGymStore(() => baseNow);

    const result = store.bookClass(memberId, 1);

    expect(result.booking.status).toBe("confirmed");

    expect(() => store.bookClass(memberId, 1)).toThrow(/Duplicate reservation/);
  });

  test("rejects booking when full and allows waitlist queueing", () => {
    const store = createSmartGymStore(() => baseNow);

    const third = store.register({
      name: "Third Member",
      email: "third@smartgym.test",
      password: "password123",
    });

    expect(() => store.bookClass(third.id, 2)).toThrow(/full/);

    const fullClass = store.joinWaitlist(third.id, 2);

    expect(fullClass.waitlistCount).toBe(2);

    expect(() => store.joinWaitlist(third.id, 2)).toThrow(
      /already on the waitlist/,
    );
  });

  test("promotes the first waitlisted member when a reservation is cancelled", () => {
    const store = createSmartGymStore(() => baseNow);

    const result = store.cancelReservation(memberId, 1);

    expect(result.booking.status).toBe("cancelled");

    expect(
      store
        .listMyBookings(secondMemberId)
        .some(
          (booking) => booking.classId === 2 && booking.status === "confirmed",
        ),
    ).toBe(true);
  });

  test("rejects member cancellation inside the 1 hour cutoff", () => {
    let clock = baseNow;

    const store = createSmartGymStore(() => clock);

    clock =
      Date.parse(
        store.state.classes.find((gymClass) => gymClass.id === 2).startsAt,
      ) -
      30 * 60 * 1000;

    expect(() => store.cancelReservation(memberId, 1)).toThrow(
      /at least 1 hour/,
    );
  });

  test("confirms only one final seat under repeated booking attempts", () => {
    const store = createSmartGymStore(() => baseNow);

    store.bookClass(memberId, 1);
    store.bookClass(secondMemberId, 1);

    const third = store.register({
      name: "Final Seat",
      email: "final@smartgym.test",
      password: "password123",
    });

    expect(() => store.bookClass(third.id, 1)).toThrow(/full/);

    const filled = store.listClasses().find((gymClass) => gymClass.id === 1);

    expect(filled.booked).toBe(2);
    expect(filled.spotsLeft).toBe(0);
  });

  test("records failed notification delivery after three retries when staff cancels a class", () => {
    const store = createSmartGymStore(() => baseNow);

    store.cancelClass(staffId, 2, true);

    const failed = store
      .listNotifications(staffId)
      .find((notification) => notification.type === "class-cancelled");

    expect(failed.status).toBe("failed");
    expect(failed.attempts).toBe(4);
  });

  test("allows staff but not members to view attendance reports", () => {
    const store = createSmartGymStore(() => baseNow);

    expect(() => store.attendanceReport(memberId)).toThrow(/Gym staff only/);

    expect(store.attendanceReport(staffId).length > 0).toBe(true);
  });
});

function futureClass(overrides = {}) {
  return {
    title: "Boundary Bootcamp",
    instructor: "Devon Hart",
    room: "Studio Q",
    startsAt: new Date(baseNow + 48 * 60 * 60 * 1000).toISOString(),
    durationMinutes: 45,
    capacity: 12,
    ...overrides,
  };
}
