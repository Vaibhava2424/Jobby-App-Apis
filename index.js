import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();
console.log("JWT_SECRET:", process.env.JWT_SECRET); // Should print your secret


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
  package_per_annum: { type: String, required: true }
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

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const newUser = new User({ username, password, email });
    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    res.json({ message: "Signup successful", token });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong", details: err.message });
  }
});


// Login
app.post("/signup", async (req, res) => {
  const { username, password, email } = req.body;

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const newUser = new User({ username, password, email });
    await newUser.save();

    const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, { expiresIn: "30d" });

    res.json({ message: "Signup successful", token });
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

// Get all jobs
app.get('/api/jobs', async (req, res) => {
  try {
    const jobs = await Job.find();
    res.json(jobs);
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

// ------------------ Start Server ------------------
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB Connected');
    app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
  })
  .catch(err => console.log('MongoDB connection error:', err.message));
