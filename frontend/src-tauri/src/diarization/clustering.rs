use ndarray::Array1;

/// Cosine similarity between two embedding vectors.
pub fn cosine_similarity(a: &Array1<f32>, b: &Array1<f32>) -> f32 {
    let dot = a.dot(b);
    let norm_a = a.dot(a).sqrt();
    let norm_b = b.dot(b).sqrt();
    dot / (norm_a * norm_b + 1e-8)
}

/// Agglomerative Hierarchical Clustering (AHC) using average linkage.
///
/// Groups speaker embeddings into clusters based on cosine similarity.
///
/// # Arguments
/// * `embeddings` - Slice of speaker embedding vectors (one per transcript segment)
/// * `num_speakers` - If `Some(k)`, force exactly `k` clusters. If `None`, auto-detect
///   by stopping when the maximum inter-cluster similarity drops below `threshold`.
/// * `threshold` - Cosine similarity threshold for auto-detection (default: 0.75)
///
/// # Returns
/// A `Vec<usize>` of cluster assignments, one per embedding (0-indexed cluster IDs).
pub fn cluster_embeddings(
    embeddings: &[Array1<f32>],
    num_speakers: Option<u8>,
    threshold: f32,
) -> Vec<usize> {
    let n = embeddings.len();
    if n == 0 {
        return vec![];
    }
    if n == 1 {
        return vec![0];
    }

    // Initialize: each embedding is its own cluster
    let mut cluster_assignments: Vec<usize> = (0..n).collect();
    let mut active_clusters: Vec<usize> = (0..n).collect();

    // Precompute pairwise similarity matrix (upper triangle)
    let mut similarity = vec![vec![0.0f32; n]; n];
    for i in 0..n {
        for j in (i + 1)..n {
            let sim = cosine_similarity(&embeddings[i], &embeddings[j]);
            similarity[i][j] = sim;
            similarity[j][i] = sim;
        }
    }

    let target_clusters = num_speakers.map(|k| k as usize).unwrap_or(1);

    loop {
        let num_active = active_clusters.len();
        if num_active <= 1 {
            break;
        }

        // If we have a fixed target and reached it, stop
        if num_speakers.is_some() && num_active <= target_clusters {
            break;
        }

        // Find the two most similar active clusters (average linkage)
        let mut best_sim = f32::NEG_INFINITY;
        let mut best_pair = (0usize, 0usize);

        for i_idx in 0..num_active {
            for j_idx in (i_idx + 1)..num_active {
                let ci = active_clusters[i_idx];
                let cj = active_clusters[j_idx];
                let avg_sim =
                    average_linkage_similarity(&cluster_assignments, &similarity, ci, cj, n);
                if avg_sim > best_sim {
                    best_sim = avg_sim;
                    best_pair = (ci, cj);
                }
            }
        }

        // For auto-detection: stop if best similarity is below threshold AND we have 6 or fewer clusters
        if num_speakers.is_none() && best_sim < threshold && num_active <= 6 {
            break;
        }

        // Merge: reassign all members of cluster best_pair.1 to best_pair.0
        let (merge_into, merge_from) = best_pair;
        for assignment in cluster_assignments.iter_mut() {
            if *assignment == merge_from {
                *assignment = merge_into;
            }
        }

        // Remove merge_from from active clusters
        active_clusters.retain(|&c| c != merge_from);
    }

    // Renumber clusters to be contiguous 0, 1, 2, ...
    renumber_clusters(&cluster_assignments)
}

/// Computes the average pairwise similarity between all members of two clusters.
fn average_linkage_similarity(
    assignments: &[usize],
    similarity: &[Vec<f32>],
    cluster_a: usize,
    cluster_b: usize,
    n: usize,
) -> f32 {
    let mut total_sim = 0.0f32;
    let mut count = 0u32;

    for i in 0..n {
        if assignments[i] != cluster_a {
            continue;
        }
        for j in 0..n {
            if assignments[j] != cluster_b {
                continue;
            }
            total_sim += similarity[i][j];
            count += 1;
        }
    }

    if count == 0 {
        f32::NEG_INFINITY
    } else {
        total_sim / count as f32
    }
}

/// Renumber cluster assignments to be contiguous 0-indexed values.
fn renumber_clusters(assignments: &[usize]) -> Vec<usize> {
    let mut mapping = std::collections::HashMap::new();
    let mut next_id = 0usize;
    let mut result = Vec::with_capacity(assignments.len());

    for &cluster in assignments {
        let id = *mapping.entry(cluster).or_insert_with(|| {
            let id = next_id;
            next_id += 1;
            id
        });
        result.push(id);
    }

    result
}

/// Compute the L2-normalized centroid of a list of embeddings.
pub fn compute_centroid(embeddings: &[Array1<f32>]) -> Array1<f32> {
    if embeddings.is_empty() {
        return ndarray::Array1::zeros(1); // Should not happen in practice
    }
    
    let dim = embeddings[0].len();
    let mut centroid = ndarray::Array1::<f32>::zeros(dim);
    
    for emb in embeddings {
        centroid = centroid + emb;
    }
    
    // Mean
    let count = embeddings.len() as f32;
    centroid = centroid / count;
    
    // L2 Normalize
    let norm = centroid.dot(&centroid).sqrt();
    if norm > 1e-8 {
        centroid = centroid / norm;
    }
    
    centroid
}

/// Find the index of the nearest centroid.
pub fn nearest_centroid(embedding: &Array1<f32>, centroids: &[Array1<f32>]) -> usize {
    let mut best_sim = f32::NEG_INFINITY;
    let mut best_idx = 0;
    
    for (i, centroid) in centroids.iter().enumerate() {
        let sim = cosine_similarity(embedding, centroid);
        if sim > best_sim {
            best_sim = sim;
            best_idx = i;
        }
    }
    
    best_idx
}

#[cfg(test)]
mod tests {
    use super::*;
    use ndarray::array;

    #[test]
    fn test_cosine_similarity_identical() {
        let a = array![1.0, 0.0, 0.0];
        let b = array![1.0, 0.0, 0.0];
        let sim = cosine_similarity(&a, &b);
        assert!((sim - 1.0).abs() < 1e-6);
    }

    #[test]
    fn test_cosine_similarity_orthogonal() {
        let a = array![1.0, 0.0, 0.0];
        let b = array![0.0, 1.0, 0.0];
        let sim = cosine_similarity(&a, &b);
        assert!(sim.abs() < 1e-6);
    }

    #[test]
    fn test_cluster_single() {
        let embeddings = vec![array![1.0, 0.0, 0.0]];
        let result = cluster_embeddings(&embeddings, None, 0.75);
        assert_eq!(result, vec![0]);
    }

    #[test]
    fn test_cluster_two_distinct_speakers() {
        // Two very different embeddings should remain in separate clusters
        let embeddings = vec![
            array![1.0, 0.0, 0.0],
            array![1.0, 0.1, 0.0],
            array![0.0, 0.0, 1.0],
            array![0.0, 0.1, 1.0],
        ];
        let result = cluster_embeddings(&embeddings, Some(2), 0.75);
        // First two should be in one cluster, last two in another
        assert_eq!(result[0], result[1]);
        assert_eq!(result[2], result[3]);
        assert_ne!(result[0], result[2]);
    }

    #[test]
    fn test_cluster_forced_count() {
        let embeddings = vec![
            array![1.0, 0.0, 0.0],
            array![0.0, 1.0, 0.0],
            array![0.0, 0.0, 1.0],
        ];
        let result = cluster_embeddings(&embeddings, Some(2), 0.75);
        let unique: std::collections::HashSet<_> = result.iter().collect();
        assert_eq!(unique.len(), 2);
    }
}
