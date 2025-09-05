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
    if (existingUser) return res.status(400).json({ error: "User already exists" });

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

// ===================== FEEDBACK ROUTES =====================

// CREATE feedback (POST)
app.post("/feedback", async (req, res) => {
  try {
    const { username, message, ...rest } = req.body;

    if (!username || !message) {
      return res.status(400).json({ error: "Username and message are required" });
    }

    const feedbackDoc = {
      username,
      message,
      ...rest,
      createdAt: new Date(),
    };

    const result = await db.collection("feedback").insertOne(feedbackDoc);

    res.status(201).json({
      message: "Feedback submitted successfully",
      insertedId: result.insertedId,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to submit feedback", details: err.message });
  }
});


// READ all feedback (GET)
app.get("/feedback", async (req, res) => {
  try {
    const feedbacks = await db.collection("feedback").find().toArray();
    res.json(feedbacks);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch feedback", details: err.message });
  }
});

// READ single feedback by ID (GET)
import { ObjectId } from "mongodb";

app.get("/feedback/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const feedback = await db.collection("feedback").findOne({ _id: new ObjectId(id) });

    if (!feedback) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    res.json(feedback);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch feedback", details: err.message });
  }
});


// UPDATE feedback by ID (PUT)
app.put("/feedback/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const result = await db.collection("feedback").updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...updates, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    res.json({ message: "Feedback updated successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to update feedback", details: err.message });
  }
});


// DELETE feedback by ID (DELETE)
app.delete("/feedback/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.collection("feedback").deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Feedback not found" });
    }

    res.json({ message: "Feedback deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete feedback", details: err.message });
  }
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
    process.exit(1);
  });
