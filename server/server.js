const express = require('express');
const app = express();
const cors = require('cors');
const corsOptions = {
    origin: ["http://localhost:8080"]
};
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



app.listen(8080, '0.0.0.0', () => {
    console.log("server started on port 8080");
})

app.post("/api", async (req, res) => {
    const {angler, trip, fish} = req.body;
    const {email_addr, name_first, name_last} = angler;
    const {num_anglers, trip_date, area_fished, bait_type, fishing_type, time_fishing, target_trout, trout_time, target_bass, bass_time, target_pike, pike_time, target_yp, yp_time, target_wp, wp_time, target_sunfish, sunfish_time, target_bullhead, bullhead_time, no_fish, personal_notes} = req.body.trip;
    const {species, length, kept, released} = req.body.fish;
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
            await client.query("COMMIT");
            res.status(201).json({ message: "Submission complete" });
    }
    catch (err) {
        await client.query("ROLLBACK");
        console.error("Error submitting form:", err);
        res.status(500).json({ error: "Submission failed" });
    }
    finally{
        client.release();
    }
});