const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const { checkDbConnection } = require("./config/db");
const authRoutes = require("./routes/auth");
const studentRoutes = require("./routes/student");
const teacherRoutes = require("./routes/teacher");
const { authRequired, requireStudent, requireTeacher } = require("./middleware/auth");

const app = express();

// Middleware
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Test Route
app.get("/", (req, res) => {
  res.send("Server is running...");
});

app.get("/api/health", async (req, res) => {
  return res.json({ ok: true, status: "up" });
});

app.use("/api/auth", authRoutes);
app.use("/api/student", authRequired, requireStudent, studentRoutes);
app.use("/api/teacher", authRequired, requireTeacher, teacherRoutes);

// Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  checkDbConnection();
});