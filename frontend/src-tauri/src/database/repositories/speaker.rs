use crate::database::models::MeetingSpeaker;
use chrono::Utc;
use sqlx::{Error as SqlxError, SqlitePool, Acquire};
use tracing::{error, info};
use uuid::Uuid;

pub struct SpeakerRepository;

impl SpeakerRepository {
    /// Saves a batch of speakers identified by diarization for a meeting.
    /// Clears any previous speakers for that meeting first.
    pub async fn save_speakers(
        pool: &SqlitePool,
        meeting_id: &str,
        speakers: &[MeetingSpeaker],
    ) -> Result<(), SqlxError> {
        let mut conn = pool.acquire().await?;
        let mut tx = conn.begin().await?;

        // Clear previous diarization results for this meeting
        sqlx::query("DELETE FROM meeting_speakers WHERE meeting_id = ?")
            .bind(meeting_id)
            .execute(&mut *tx)
            .await?;

        let now = Utc::now().to_rfc3339();

        for speaker in speakers {
            let id = format!("speaker-{}", Uuid::new_v4());
            sqlx::query(
                "INSERT INTO meeting_speakers (id, meeting_id, internal_label, custom_name, sample_start_time, sample_end_time, segment_count, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            )
            .bind(&id)
            .bind(meeting_id)
            .bind(&speaker.internal_label)
            .bind(&speaker.custom_name)
            .bind(speaker.sample_start_time)
            .bind(speaker.sample_end_time)
            .bind(speaker.segment_count)
            .bind(&now)
            .execute(&mut *tx)
            .await?;
        }

        tx.commit().await?;

        info!(
            "Saved {} speakers for meeting {}",
            speakers.len(),
            meeting_id
        );
        Ok(())
    }

    /// Fetches all speakers for a given meeting.
    pub async fn get_speakers(
        pool: &SqlitePool,
        meeting_id: &str,
    ) -> Result<Vec<MeetingSpeaker>, SqlxError> {
        let speakers = sqlx::query_as::<_, MeetingSpeaker>(
            "SELECT id, meeting_id, internal_label, custom_name, sample_start_time, sample_end_time, segment_count, created_at
             FROM meeting_speakers
             WHERE meeting_id = ?
             ORDER BY internal_label ASC",
        )
        .bind(meeting_id)
        .fetch_all(pool)
        .await?;

        Ok(speakers)
    }

    /// Updates the custom display name for a speaker.
    pub async fn update_speaker_name(
        pool: &SqlitePool,
        meeting_id: &str,
        internal_label: &str,
        custom_name: &str,
    ) -> Result<(), SqlxError> {
        let result = sqlx::query(
            "UPDATE meeting_speakers SET custom_name = ? WHERE meeting_id = ? AND internal_label = ?",
        )
        .bind(custom_name)
        .bind(meeting_id)
        .bind(internal_label)
        .execute(pool)
        .await?;

        if result.rows_affected() == 0 {
            error!(
                "No speaker found with label '{}' in meeting '{}'",
                internal_label, meeting_id
            );
        } else {
            info!(
                "Updated speaker '{}' -> '{}' in meeting '{}'",
                internal_label, custom_name, meeting_id
            );
        }

        Ok(())
    }

    /// Merges speaker `label_b` into `label_a`.
    /// All transcript rows referencing `label_b` are reassigned to `label_a`,
    /// and the `label_b` row is deleted from `meeting_speakers`.
    pub async fn merge_speakers(
        pool: &SqlitePool,
        meeting_id: &str,
        label_a: &str,
        label_b: &str,
    ) -> Result<(), SqlxError> {
        let mut conn = pool.acquire().await?;
        let mut tx = conn.begin().await?;

        // Reassign all transcript segments from label_b to label_a
        sqlx::query(
            "UPDATE transcripts SET speaker_label = ? WHERE meeting_id = ? AND speaker_label = ?",
        )
        .bind(label_a)
        .bind(meeting_id)
        .bind(label_b)
        .execute(&mut *tx)
        .await?;

        // Update segment_count on label_a
        sqlx::query(
            "UPDATE meeting_speakers SET segment_count = (
                SELECT COUNT(*) FROM transcripts WHERE meeting_id = ? AND speaker_label = ?
             ) WHERE meeting_id = ? AND internal_label = ?",
        )
        .bind(meeting_id)
        .bind(label_a)
        .bind(meeting_id)
        .bind(label_a)
        .execute(&mut *tx)
        .await?;

        // Delete the merged speaker row
        sqlx::query("DELETE FROM meeting_speakers WHERE meeting_id = ? AND internal_label = ?")
            .bind(meeting_id)
            .bind(label_b)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;

        info!(
            "Merged speaker '{}' into '{}' for meeting '{}'",
            label_b, label_a, meeting_id
        );
        Ok(())
    }

    /// Bulk-updates the speaker_label column on transcript rows after diarization.
    pub async fn update_transcript_speaker_labels(
        pool: &SqlitePool,
        assignments: &[(String, String)], // (transcript_id, speaker_label)
    ) -> Result<(), SqlxError> {
        let mut conn = pool.acquire().await?;
        let mut tx = conn.begin().await?;

        for (transcript_id, speaker_label) in assignments {
            sqlx::query("UPDATE transcripts SET speaker_label = ? WHERE id = ?")
                .bind(speaker_label)
                .bind(transcript_id)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;

        info!(
            "Updated speaker labels for {} transcript segments",
            assignments.len()
        );
        Ok(())
    }
}
