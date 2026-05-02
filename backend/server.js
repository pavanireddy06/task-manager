require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const { OAuth2Client } = require("google-auth-library");

const app = express();

/* ================= MIDDLEWARE ================= */
app.use(express.json());
app.use(cors({ origin: "*" }));

/* ================= FILE UPLOAD ================= */
const upload = multer({ dest: "uploads/" });

/* ================= GOOGLE ================= */
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/* ================= DATABASE ================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch(err => console.log("❌ DB Error:", err.message));

/* ================= MODELS ================= */

// USER MODEL (with role)
const User = mongoose.model("User", {
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: "member" } // 🔥 role added
});

// TASK MODEL (Trello + collaboration + file)
const Task = mongoose.model("Task", {
  title: String,
  fileUrl: String,
  status: { type: String, default: "todo" }, // todo, doing, done
  users: [String], // collaboration
  completed: { type: Boolean, default: false }
});

/* ================= AUTH MIDDLEWARE ================= */

const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ msg: "No token" });

  try {
    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ msg: "Invalid token" });
  }
};

// ADMIN ONLY
const adminOnly = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({ msg: "Admin only access" });
  }
  next();
};

/* ================= SOCKET.IO ================= */

const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

io.on("connection", (socket) => {
  console.log("🟢 User connected:", socket.id);

  socket.on("join", (userId) => {
    socket.join(userId);
  });

  socket.on("disconnect", () => {
    console.log("🔴 User disconnected");
  });
});

/* ================= AUTH ROUTES ================= */

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ msg: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashed,
      role: "member"
    });

    await user.save();

    res.json({ msg: "Registered successfully" });

  } catch (err) {
    res.status(500).json({ msg: "Server error" });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: "User not found" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ msg: "Invalid password" });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ token });

  } catch {
    res.status(500).json({ msg: "Login error" });
  }
});

// GOOGLE LOGIN
app.post("/api/auth/google", async (req, res) => {
  try {
    const ticket = await client.verifyIdToken({
      idToken: req.body.token,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    let user = await User.findOne({ email: payload.email });

    if (!user) {
      user = new User({
        name: payload.name,
        email: payload.email,
        password: "google",
        role: "member"
      });
      await user.save();
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET
    );

    res.json({ token });

  } catch {
    res.status(400).json({ msg: "Google login failed" });
  }
});

/* ================= FILE UPLOAD ================= */

app.post("/api/upload", upload.single("file"), (req, res) => {
  res.json({ url: `/uploads/${req.file.filename}` });
});

/* ================= TASK ROUTES ================= */

// CREATE TASK
app.post("/api/tasks", auth, async (req, res) => {
  try {
    const { title, fileUrl, users } = req.body;

    const task = new Task({
      title,
      fileUrl,
      users: users || [req.user.id]
    });

    await task.save();

    // 🔔 notify users
    task.users.forEach(userId => {
      io.to(userId).emit("taskUpdated");
      io.to(userId).emit("notification", {
        message: `New task: ${task.title}`
      });
    });

    res.json(task);

  } catch {
    res.status(500).json({ msg: "Task creation failed" });
  }
});

// GET TASKS (shared)
app.get("/api/tasks", auth, async (req, res) => {
  try {
    const tasks = await Task.find({
      users: req.user.id
    });

    res.json(tasks);

  } catch {
    res.status(500).json({ msg: "Fetch failed" });
  }
});

// UPDATE STATUS (Trello)
app.put("/api/tasks/status/:id", auth, async (req, res) => {
  try {
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    task.users.forEach(userId => {
      io.to(userId).emit("taskUpdated");
      io.to(userId).emit("notification", {
        message: `Task updated`
      });
    });

    res.json(task);

  } catch {
    res.status(500).json({ msg: "Update failed" });
  }
});

// DELETE TASK (ADMIN ONLY)
app.delete("/api/tasks/:id", auth, adminOnly, async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);

    await Task.findByIdAndDelete(req.params.id);

    task.users.forEach(userId => {
      io.to(userId).emit("taskUpdated");
    });

    res.json({ msg: "Deleted successfully" });

  } catch {
    res.status(500).json({ msg: "Delete failed" });
  }
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});