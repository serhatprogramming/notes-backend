const mongoose = require("mongoose");
const supertest = require("supertest");
const app = require("../app");

const api = supertest(app);

const Note = require("../models/note");
const bcrypt = require("bcrypt");
const User = require("../models/user");

const {
  initialNotes,
  nonExistingId,
  notesInDb,
  usersInDb,
} = require("./test_helper");

beforeEach(async () => {
  await Note.deleteMany({});
  await Note.insertMany(initialNotes);
});

test("notes are returned as json", async () => {
  await api
    .get("/api/notes")
    .expect(200)
    .expect("Content-Type", /application\/json/);
}, 100000);

test("all initial notes are returned", async () => {
  const response = await api.get("/api/notes");

  expect(response.body).toHaveLength(initialNotes.length);
});

test("a specific notes within the notes", async () => {
  const notes = await notesInDb();

  const contents = notes.map((note) => note.content);

  expect(contents).toContain("Browser can execute only JavaScript");
});

test("a specific note can be viewed", async () => {
  const notes = await notesInDb();

  const noteToView = notes[0];

  const noteToCheck = await api
    .get(`/api/notes/${noteToView.id}`)
    .expect(200)
    .expect("Content-Type", /application\/json/);

  expect(noteToCheck.body).toEqual(noteToView);
});

test("a note can be deleted", async () => {
  const notesAtStart = await notesInDb();
  const noteToDelete = notesAtStart[0];

  await api.delete(`/api/notes/${noteToDelete.id}`).expect(204);

  const notesAtEnd = await notesInDb();

  expect(notesAtEnd.length).toBe(notesAtStart.length - 1);

  const contents = notesAtEnd.map((note) => note.content);

  expect(contents).not.toContain(noteToDelete.content);
});

test("a valid note can be added", async () => {
  const newNote = {
    content: "async/await simplifies making async calls",
    important: true,
  };

  await api
    .post("/api/notes")
    .send(newNote)
    .expect(201)
    .expect("Content-Type", /application\/json/);

  const response = await api.get("/api/notes");

  const notes = await notesInDb();

  const contents = notes.map((note) => note.content);

  expect(contents).toContain("async/await simplifies making async calls");
});

test("note without content is not added", async () => {
  const newNote = { important: false };
  await api.post("/api/notes").send(newNote).expect(400);
  const notes = await notesInDb();
  expect(notes).toHaveLength(initialNotes.length);
});

test("fails with statuscode 400 id is invalid", async () => {
  const invalidId = "5a3d5da59070081a82a3445";

  await api.get(`/api/notes/${invalidId}`).expect(400);
});

describe("when there is initially one user in db", () => {
  beforeEach(async () => {
    await User.deleteMany({});

    const passwordHash = await bcrypt.hash("secret", 10);
    const user = new User({ username: "root", passwordHash });

    await user.save();
  });

  test("creation of a fresh user with success", async () => {
    const usersAtStart = await usersInDb();

    const user = {
      username: "jdoe",
      name: "John Doe",
      password: "password",
    };

    await api
      .post("/api/users")
      .send(user)
      .expect(201)
      .expect("Content-Type", /application\/json/);

    const usersAtEnd = await usersInDb();
    expect(usersAtEnd.length).toBe(usersAtStart.length + 1);

    const userNames = usersAtEnd.map((user) => user.username);
    expect(userNames).toContain("root");
  });

  test("creation fails with proper statuscode and message if username already taken", async () => {
    const usersAtStart = await usersInDb();

    const newUser = {
      username: "root",
      name: "Superuser",
      password: "salainen",
    };

    const result = await api
      .post("/api/users")
      .send(newUser)
      .expect(400)
      .expect("Content-Type", /application\/json/);

    expect(result.body.error).toContain("expected `username` to be unique");

    const usersAtEnd = await usersInDb();
    expect(usersAtEnd).toHaveLength(usersAtStart.length);
  });
});

afterAll(async () => {
  await mongoose.connection.close();
});
