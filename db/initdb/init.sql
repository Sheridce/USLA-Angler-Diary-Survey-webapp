CREATE TABLE angler ( angler_id SERIAL PRIMARY KEY, email_addr text NOT NULL, name_first text , name_last text);

CREATE TABLE trip ( trip_id SERIAL PRIMARY KEY, angler_id INT REFERENCES angler(angler_id) ON DELETE CASCADE, num_anglers int, trip_date date, area_fished text, bait_type text, fishing_type text, fishing_time interval, target_trout boolean, trout_time interval, target_bass boolean, bass_time interval, target_pike boolean, pike_time interval, target_yp boolean, yp_time interval, target_wp boolean, wp_time interval, target_sunfish boolean, sunfish_time interval, target_bullhead boolean, bullhead_time interval, no_fish boolean, personal_notes text );

CREATE TABLE fish (fish_id SERIAL PRIMARY KEY, trip_id INT REFERENCES trip(trip_id) ON DELETE CASCADE, species text, length text, kept boolean, released boolean);

CREATE TABLE trip_photos(photo_id SERIAL PRIMARY KEY, trip_id INT REFERENCES trip(trip_id) ON DELETE CASCADE, file_path TEXT NOT NULL, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP);