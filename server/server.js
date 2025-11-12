const express = require('express');
const app = express();
const cors = require('cors');
const corsOptions = {
    origin: ["http://localhost"]
};
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('@dotenvx/dotenvx').config()
const Pool = require('pg').Pool;

const pool = new Pool ({
    user: process.env.DB_USER,
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'ads-db',
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432
})

app.use(cors(corsOptions));
app.use(express.json());

app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)){
            fs.mkdirSync(uploadDir, { recursive: true});
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}${path.extname(file.originalname)}`;
        cb (null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: {filesize: 10*1024*1024}, //10MB filesize limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpg|jpeg|png|heic/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only image files (jpeg, jpg, png, heic) are allowed'));
        }
    }
});

app.listen(8080, '0.0.0.0', () => {
    console.log("server started on port 8080");
})

app.post("/api", upload.array('photos', 10), async (req, res) => {
    const {angler, trip, fish} = JSON.parse(req.body.data);
    const {email_addr, name_first, name_last} = angler;
    const {num_anglers, trip_date, area_fished, bait_type, fishing_type, time_fishing, target_trout, trout_time, target_bass, bass_time, target_pike, pike_time, target_yp, yp_time, target_wp, wp_time, target_sunfish, sunfish_time, target_bullhead, bullhead_time, no_fish, personal_notes} = trip;
    const client = await pool.connect();
    let anglerID;
    try{
        const checkAnglers = await client.query(
                "SELECT angler_id FROM angler WHERE email_addr = $1",
                [email_addr]
        )
            if (checkAnglers.rows.length > 0) {
                anglerID = checkAnglers.rows[0].angler_id;
                console.log("found angler with id: ", anglerID);
            } else {
                const anglerResult = await client.query(
                    "INSERT INTO angler (email_addr, name_first, name_last) VALUES ($1, $2, $3) RETURNING angler_id",
                    [email_addr, name_first, name_last]
                );
                anglerID = anglerResult.rows[0].angler_id;
            }
            const tripResult = await client.query(
                "INSERT INTO trip (angler_id, num_anglers, trip_date, area_fished, bait_type, fishing_type, fishing_time, target_trout, trout_time, target_bass, bass_time, target_pike, pike_time, target_yp, yp_time, target_wp, wp_time, target_sunfish, sunfish_time, target_bullhead, bullhead_time, no_fish, personal_notes) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23) RETURNING trip_id",
                [anglerID, num_anglers, trip_date, area_fished, bait_type, fishing_type, `${time_fishing} hours`, target_trout, `${trout_time} hours`, target_bass, `${bass_time} hours`, target_pike, `${pike_time} hours`, target_yp, `${yp_time} hours`, target_wp, `${wp_time} hours`, target_sunfish, `${sunfish_time} hours`, target_bullhead, `${bullhead_time} hours`, no_fish, personal_notes]
            )
            const tripID = tripResult.rows[0].trip_id;
            for (const f of fish){
                const {species, length, kept, released} = f;
                await client.query(
                    "INSERT INTO fish (trip_id, species, length, kept, released) VALUES ($1, $2, $3, $4, $5)",
                    [tripID, species, length, kept, released]
                );
            }
            if (req.files && req.files.length > 0) {
                for (const file of req.files) {
                    await client.query(
                        "INSERT INTO trip_photos (trip_id, file_path) VALUES ($1, $2)",
                        [tripID, file.path]
                    );
                }
            }
            await client.query("COMMIT");
            res.status(201).json({ message: "Submission complete", photoCount: req.files ? req.files.length : 0});
    }
    catch (err) {
        await client.query("ROLLBACK");
        if (req.files) {
            req.files.forEach(file => {
                fs.unlink(file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting file:', unlinkErr);
                });
            });
        }
        console.error("Error submitting form:", err);
        res.status(500).json({ error: "Submission failed" });
    }
    finally{
        client.release();
    }
});

app.get("/api/angler", async (req, res) => {
    try{
        const result = await pool.query(
            'SELECT * FROM angler',
        )
        res.status(200).json(result.rows);
    }
    catch (err){
        console.error(err);
        res.status(500).json({error: 'Error retrieving data'});
    }
})

app.get("/api/angler/email/:email", async (req, res) =>{
    const email = req.params.email;
    try{
        const result = await pool.query(
            'SELECT * FROM angler WHERE email_addr = $1',
            [email]
        )

        if (result.rows.length > 0){
            res.status(200).json(result.rows[0]);
        }
        else{
            res.status(404).json({message: 'Angler not found'});
        }
    }
    catch (err){
        console.error(err);
        res.status(500).json({error: 'Error checking email'});
    }
})


app.get("/api/trip", async (req, res) => {
    try{
        const result = await pool.query(
            'SELECT * FROM trip',
        )
        res.status(200).json(result.rows);
    }
    catch (err){
        console.error(err);
        res.status(500).json({error: 'Error retrieving data'});
    }
})

app.get("/api/fish", async (req, res) => {
    try{
        const result = await pool.query(
            'SELECT * FROM fish',
        )
        res.status(200).json(result.rows);
    }
    catch (err){
        console.error(err);
        res.status(500).json({error: 'Error retrieving data'});
    }
})

app.put("/api/angler/:angler_id", async(req, res) => {
    const id = req.params.angler_id;
    const{email_addr, name_first, name_last} = req.body;    
    try{
        const result = await pool.query(
            'UPDATE angler SET email_addr = $2, name_first = $3, name_last = $4 WHERE angler_id =$1 RETURNING *',
            [id, email_addr, name_first, name_last]
        )
        res.status(200).json(result.rows[0]);
    }
    catch(err){
        console.error(err);
        res.status(500).json({error: 'Error updating data'})
    }
})

app.put("/api/trip/:trip_id", async(req, res) => {
    const id = req.params.trip_id;
    const {num_anglers, trip_date, area_fished, bait_type, fishing_type, fishing_time, target_trout, trout_time, target_bass, bass_time, target_pike, pike_time, target_yp, yp_time, target_wp, wp_time, target_sunfish, sunfish_time, target_bullhead, bullhead_time, no_fish, personal_notes} = req.body;
    try{
        const result = await pool.query(
            'UPDATE trip SET num_anglers = $2, trip_date = $3, area_fished = $4, bait_type = $5, fishing_type = $6, fishing_time = $7, target_trout = $8, trout_time = $9, target_bass = $10, bass_time = $11, target_pike = $12, pike_time = $13, target_yp = $14, yp_time = $15, target_wp = $16, wp_time = $17, target_sunfish = $18, sunfish_time = $19, target_bullhead = $20, bullhead_time = $21, no_fish = $22, personal_notes = $23 WHERE trip_id =$1 RETURNING *',
            [id, num_anglers, trip_date, area_fished, bait_type, fishing_type, fishing_time, target_trout, trout_time, target_bass, bass_time, target_pike, pike_time, target_yp, yp_time, target_wp, wp_time, target_sunfish, sunfish_time, target_bullhead, bullhead_time, no_fish, personal_notes]
        )
        res.status(200).json(result.rows[0]);
    }
    catch(err){
        console.error(err);
        res.status(500).json({error: 'Error updating data'})
    }
})

app.get("/api/trip/:trip_id/photos", async (req, res) => {
    const tripId = req.params.trip_id;
    try {
        const result = await pool.query(
            'SELECT * FROM trip_photos WHERE trip_id = $1 ORDER BY uploaded_at DESC',
            [tripId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error retrieving photos' });
    }
});

app.put("/api/fish/:fish_id", async(req, res) => {
    const id = req.params.fish_id;
    const {species, length, kept, released} = req.body;
    try{
        const result = await pool.query(
            'UPDATE fish SET species = $2, length=$3, kept=$4, released=$5 WHERE fish_id =$1 RETURNING *',
            [id, species, length, kept, released]
        )
        res.status(200).json(result.rows[0]);
    }
    catch(err){
        console.error(err);
        res.status(500).json({error: 'Error updating data'})
    }
})

app.delete("/api/angler/:angler_id", async(req, res) => {
    const id = req.params.angler_id;
    try{
        const result = await pool.query(
            'DELETE FROM angler WHERE angler_id = $1',
            [id]
        )
        res.status(200).json();
    }
    catch(err){
        console.error(err);
        res.status(500).json({error: 'Error removing data'})
    }
})