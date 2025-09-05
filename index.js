import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const { sign, verify } = jwt;

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5001;

// ------------------ Job Schema ------------------
const jobSchema = new mongoose.Schema({
  title: { type: String, required: true },
  company_logo_url: { type: String },
  rating: { type: Number, default: 0 },
  job_description: { type: String, required: true },
  location: { type: String, required: true },
  employment_type: { type: String, required: true },
  package_per_annum: { type: String, required: true },

  // Extra fields for detailed view
  company_website_url: { type: String, default: "" },
  life_at_company: {
    description: { type: String, default: "" },
    image_url: { type: String, default: "" }
  },
  skills: [
    {
      name: { type: String, default: "" },
      image_url: { type: String, default: "" }
    }
  ]
}, { timestamps: true });

const Job = mongoose.model('Job', jobSchema);

// ------------------ User Schema ------------------
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// ------------------ Routes ------------------

// Test route
app.get('/', (req, res) => {
  res.send('Jobby Backend is running!');
});

// ------------------ Auth Routes ------------------

// Signup
app.post("/signup", async (req, res) => {
  const { username, password, email } = req.body;

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "JWT_SECRET is not set" });
  }

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const newUser = new User({ username, password, email });
    await newUser.save();

    const token = sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    res.json({ message: "Signup successful", token });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!process.env.JWT_SECRET) {
    return res.status(500).json({ error: "JWT_SECRET is not set" });
  }

  try {
    const user = await User.findOne({ username, password });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const token = sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "30d" });
    res.json({ message: "Login successful", token });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});

// Protected route
app.get("/protected", (req, res) => {
  const token = req.headers["authorization"];
  if (!token) return res.status(403).json({ error: "Token missing" });

  try {
    const decoded = verify(token, process.env.JWT_SECRET);
    res.json({ message: "Protected data", userId: decoded.id });
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

// Get all users
app.get("/all", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});

// Delete user
app.delete("/users/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) return res.status(404).json({ error: "User not found" });

    res.json({ message: "User deleted successfully", user: deletedUser });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user", details: err.message });
  }
});

// ------------------ Job Routes ------------------

// Add one or many jobs
app.post('/api/jobs', async (req, res) => {
  try {
    const jobs = req.body;

    if (Array.isArray(jobs)) {
      const createdJobs = await Job.insertMany(jobs);
      return res.status(201).json({ message: 'Jobs created successfully', jobs: createdJobs });
    } else {
      const job = new Job(jobs);
      await job.save();
      return res.status(201).json({ message: 'Job created successfully', job });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all jobs (overview)
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await Job.find({}, {
      title: 1,
      company_logo_url: 1,
      rating: 1,
      job_description: 1,
      location: 1,
      employment_type: 1,
      package_per_annum: 1
    });
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get job details by ID
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ error: "Job not found" });
    res.json(job);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete job by ID
app.delete('/api/jobs/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedJob = await Job.findByIdAndDelete(id);
    if (!deletedJob) return res.status(404).json({ message: 'Job not found' });

    res.status(200).json({ message: 'Job deleted successfully', job: deletedJob });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete all jobs
app.delete('/api/jobs', async (req, res) => {
  try {
    const result = await Job.deleteMany({});
    res.status(200).json({ message: 'All jobs deleted successfully', deletedCount: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// -------------------- Feedback ---------------------
let feedbacks = [];

// Utility: get IST time
const getISTTime = () => {
  const date = new Date();
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(utc + istOffset).toISOString();
};

// Add feedback (requires JWT token in headers)
app.post("/api/feedback", async (req, res) => {
  const token = req.headers.authorization;
  if (!token) return res.status(401).json({ error: "Authorization token missing" });

  try {
    const decoded = verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const { message } = req.body;
    if (!message || message.trim() === "") return res.status(400).json({ error: "Message is required" });

    const feedback = {
      id: feedbacks.length + 1,
      username: user.username, // get username from logged-in user
      message: message.trim(),
      createdAt: getISTTime() // store in IST
    };

    feedbacks.push(feedback);
    res.status(201).json({ message: "Feedback submitted successfully", feedback });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

// Get all feedback
app.get("/api/feedback", (req, res) => {
  const allFeedback = feedbacks.map(f => ({
    id: f.id,
    username: f.username,
    message: f.message,
    createdAt: f.createdAt
  }));
  res.json(allFeedback);
});

// Delete one feedback by ID
app.delete("/api/feedback/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const index = feedbacks.findIndex(f => f.id === id);

  if (index === -1) return res.status(404).json({ error: "Feedback not found" });

  const deleted = feedbacks.splice(index, 1);
  res.json({ message: "Feedback deleted successfully", feedback: deleted[0] });
});

// Delete all feedback
app.delete("/api/feedback", (req, res) => {
  const count = feedbacks.length;
  feedbacks = [];
  res.json({ message: "All feedback deleted successfully", deletedCount: count });
});


// ------------------ Start Server ------------------
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not set in environment variables!');
  process.exit(1);
}

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB Connected');
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err.message);
    process.exit(1); // crash app so Render shows error
  });
