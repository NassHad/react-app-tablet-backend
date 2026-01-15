/**
 * Model Deduplication Helper Functions Library
 *
 * Contains all utility functions for detecting and merging duplicate models
 */

/**
 * Normalize model name by removing brand prefix
 * @param {string} name - Model name
 * @param {string} brandName - Brand name
 * @returns {string} - Normalized model name
 */
function normalizeModelName(name, brandName) {
  let normalized = name.trim();

  // Remove brand prefix (case-insensitive)
  const brandUpper = brandName.toUpperCase();
  const nameUpper = normalized.toUpperCase();

  if (nameUpper.startsWith(brandUpper + ' ')) {
    normalized = normalized.substring(brandName.length + 1).trim();
  }

  // Handle hyphenated brands (e.g., "Alfa-Romeo")
  const brandHyphenated = brandName.replace(/\s+/g, '-');
  if (nameUpper.startsWith(brandHyphenated.toUpperCase() + ' ')) {
    normalized = normalized.substring(brandHyphenated.length + 1).trim();
  }

  return normalized;
}

/**
 * Generate slug from model name
 * @param {string} name - Model name
 * @returns {string} - URL-safe slug
 */
function generateSlug(name) {
  return name
    .toLowerCase()
    .normalize('NFD')                    // Normalize unicode
    .replace(/[\u0300-\u036f]/g, '')    // Remove diacritics
    .replace(/[^a-z0-9]+/g, '-')        // Replace non-alphanumeric with -
    .replace(/^-+|-+$/g, '')            // Remove leading/trailing -
    .replace(/-+/g, '-');               // Collapse multiple -
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Edit distance
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len1 + 1).fill(null)
    .map(() => Array(len2 + 1).fill(0));

  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,           // deletion
        matrix[i][j - 1] + 1,           // insertion
        matrix[i - 1][j - 1] + cost     // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity between two strings (0-1 scale)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity score (0-1)
 */
function calculateSimilarity(str1, str2) {
  // Normalize for comparison (remove non-alphanumeric)
  const norm1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
  const norm2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (norm1 === norm2) return 1.0;

  const distance = levenshteinDistance(norm1, norm2);
  const maxLen = Math.max(norm1.length, norm2.length);

  if (maxLen === 0) return 0;

  return 1 - (distance / maxLen);
}

/**
 * Detect duplicate models within a brand+vehicle_type group
 * @param {Array} models - Array of model objects
 * @param {string} brandName - Brand name for normalization
 * @param {number} similarityThreshold - Minimum similarity (0-1)
 * @returns {Array} - Array of duplicate groups
 */
function detectDuplicates(models, brandName, similarityThreshold = 0.90) {
  const duplicateGroups = [];
  const processed = new Set();

  for (let i = 0; i < models.length; i++) {
    if (processed.has(i)) continue;

    const model1 = models[i];
    const norm1 = normalizeModelName(model1.name, brandName);
    const duplicates = [model1];

    for (let j = i + 1; j < models.length; j++) {
      if (processed.has(j)) continue;

      const model2 = models[j];
      const norm2 = normalizeModelName(model2.name, brandName);

      // Exact match after normalization
      if (norm1.toLowerCase() === norm2.toLowerCase()) {
        duplicates.push(model2);
        processed.add(j);
        continue;
      }

      // Fuzzy match with similarity threshold
      const similarity = calculateSimilarity(norm1, norm2);
      if (similarity >= similarityThreshold) {
        duplicates.push(model2);
        processed.add(j);
      }
    }

    if (duplicates.length > 1) {
      duplicateGroups.push({
        normalizedName: norm1,
        duplicates: duplicates,
        count: duplicates.length
      });
    }

    processed.add(i);
  }

  return duplicateGroups;
}

/**
 * Select primary model to keep from duplicates
 * Priority: shortest name -> earliest ID -> most relationships
 * @param {Array} duplicates - Array of duplicate model objects
 * @param {Object} db - Database connection
 * @param {Array} relationshipTables - Tables to count relationships
 * @returns {Object} - {primary, toMerge}
 */
function selectPrimaryModel(duplicates, db, relationshipTables) {
  // 1. Sort by name length (shortest first)
  const sortedByLength = [...duplicates].sort((a, b) =>
    a.name.length - b.name.length
  );

  const shortestLength = sortedByLength[0].name.length;
  const candidates = sortedByLength.filter(m =>
    m.name.length === shortestLength
  );

  if (candidates.length === 1) {
    return {
      primary: candidates[0],
      toMerge: duplicates.filter(m => m.id !== candidates[0].id)
    };
  }

  // 2. Among equal length, prefer earliest ID
  candidates.sort((a, b) => a.id - b.id);

  if (candidates.length === 1 || !relationshipTables || relationshipTables.length === 0) {
    return {
      primary: candidates[0],
      toMerge: duplicates.filter(m => m.id !== candidates[0].id)
    };
  }

  // 3. Count relationships for tie-breaking
  const withRelationCounts = candidates.map(model => {
    let relationCount = 0;

    for (const rel of relationshipTables) {
      try {
        const count = db.prepare(`
          SELECT COUNT(*) as count
          FROM ${rel.table}
          WHERE ${rel.column} = ?
        `).get(model.id);

        relationCount += count?.count || 0;
      } catch (error) {
        // Table might not exist, skip
        continue;
      }
    }

    return {
      ...model,
      relationCount
    };
  });

  withRelationCounts.sort((a, b) => b.relationCount - a.relationCount);

  const primary = withRelationCounts[0];
  const toMerge = duplicates.filter(m => m.id !== primary.id);

  return { primary, toMerge };
}

/**
 * Count relationships for a model
 * @param {Object} db - Database connection
 * @param {number} modelId - Model ID
 * @param {Array} relationshipTables - Tables to check
 * @returns {Object} - Counts by table
 */
function countRelationships(db, modelId, relationshipTables) {
  const counts = {};
  let total = 0;

  for (const rel of relationshipTables) {
    try {
      const result = db.prepare(`
        SELECT COUNT(*) as count
        FROM ${rel.table}
        WHERE ${rel.column} = ?
      `).get(modelId);

      counts[rel.table] = result?.count || 0;
      total += counts[rel.table];
    } catch (error) {
      counts[rel.table] = 0;
    }
  }

  return { counts, total };
}

/**
 * Migrate relationships from duplicate models to primary
 * @param {Object} db - Database connection
 * @param {number} primaryModelId - Primary model ID
 * @param {Array} duplicateModelIds - Duplicate model IDs
 * @param {Array} relationshipTables - Tables to migrate
 * @returns {Object} - Migration log
 */
function migrateRelationships(db, primaryModelId, duplicateModelIds, relationshipTables) {
  const migrationLog = {
    primaryModelId,
    duplicateModelIds,
    migrations: []
  };

  for (const config of relationshipTables) {
    for (const dupId of duplicateModelIds) {
      try {
        // Check for existing relationships
        const existing = db.prepare(`
          SELECT id FROM ${config.table}
          WHERE ${config.column} = ?
        `).all(dupId);

        if (existing.length > 0) {
          // Update to point to primary model
          const result = db.prepare(`
            UPDATE ${config.table}
            SET ${config.column} = ?
            WHERE ${config.column} = ?
          `).run(primaryModelId, dupId);

          migrationLog.migrations.push({
            table: config.table,
            fromModelId: dupId,
            toModelId: primaryModelId,
            recordsUpdated: result.changes
          });
        }
      } catch (error) {
        migrationLog.migrations.push({
          table: config.table,
          fromModelId: dupId,
          toModelId: primaryModelId,
          error: error.message
        });
      }
    }
  }

  return migrationLog;
}

/**
 * Delete duplicate models and their brand links
 * @param {Object} db - Database connection
 * @param {Array} duplicateModelIds - Model IDs to delete
 * @returns {Object} - Deletion log
 */
function deleteDuplicateModels(db, duplicateModelIds) {
  const deletionLog = {
    deletedModelIds: [],
    deletedBrandLinks: [],
    errors: []
  };

  for (const modelId of duplicateModelIds) {
    try {
      // 1. Delete from models_brand_lnk junction table
      const linkResult = db.prepare(`
        DELETE FROM models_brand_lnk
        WHERE model_id = ?
      `).run(modelId);

      deletionLog.deletedBrandLinks.push({
        modelId,
        linksDeleted: linkResult.changes
      });

      // 2. Delete the model itself
      const modelResult = db.prepare(`
        DELETE FROM models
        WHERE id = ?
      `).run(modelId);

      if (modelResult.changes > 0) {
        deletionLog.deletedModelIds.push(modelId);
      }

    } catch (error) {
      deletionLog.errors.push({
        modelId,
        error: error.message
      });
    }
  }

  return deletionLog;
}

/**
 * Validate database integrity
 * @param {Object} db - Database connection
 * @param {Array} relationshipTables - Tables to check
 * @returns {Object} - Validation results
 */
function validateIntegrity(db, relationshipTables) {
  const validation = {
    passed: true,
    checks: []
  };

  // Check 1: No orphaned relationships
  for (const rel of relationshipTables) {
    try {
      const orphaned = db.prepare(`
        SELECT COUNT(*) as count
        FROM ${rel.table} t
        LEFT JOIN models m ON t.${rel.column} = m.id
        WHERE m.id IS NULL
      `).get();

      const check = {
        name: `Orphaned ${rel.table}`,
        orphanedCount: orphaned.count,
        passed: orphaned.count === 0
      };

      validation.checks.push(check);

      if (orphaned.count > 0) {
        validation.passed = false;
      }
    } catch (error) {
      validation.checks.push({
        name: `Check ${rel.table}`,
        error: error.message,
        passed: false
      });
      validation.passed = false;
    }
  }

  // Check 2: All models have brand relationships
  try {
    const noBrand = db.prepare(`
      SELECT COUNT(*) as count
      FROM models m
      LEFT JOIN models_brand_lnk lnk ON m.id = lnk.model_id
      WHERE lnk.brand_id IS NULL AND m.published_at IS NOT NULL
    `).get();

    validation.checks.push({
      name: 'Models without brand',
      count: noBrand.count,
      passed: true,  // Warning only
      note: 'These models exist but are not assigned to any brand'
    });
  } catch (error) {
    validation.checks.push({
      name: 'Check brand relationships',
      error: error.message,
      passed: false
    });
    validation.passed = false;
  }

  return validation;
}

/**
 * Create database snapshot for before/after comparison
 * @param {Object} db - Database connection
 * @returns {Object} - Snapshot data
 */
function createSnapshot(db) {
  const snapshot = {
    timestamp: new Date().toISOString(),
    totalModels: 0,
    publishedModels: 0,
    totalBrands: 0,
    modelsByVehicleType: {}
  };

  // Total models
  const total = db.prepare('SELECT COUNT(*) as count FROM models').get();
  snapshot.totalModels = total.count;

  // Published models
  const published = db.prepare(`
    SELECT COUNT(*) as count FROM models WHERE published_at IS NOT NULL
  `).get();
  snapshot.publishedModels = published.count;

  // Total brands
  const brands = db.prepare('SELECT COUNT(*) as count FROM brands').get();
  snapshot.totalBrands = brands.count;

  // Models by vehicle type
  const byType = db.prepare(`
    SELECT vehicle_type, COUNT(*) as count
    FROM models
    WHERE published_at IS NOT NULL
    GROUP BY vehicle_type
  `).all();

  for (const row of byType) {
    snapshot.modelsByVehicleType[row.vehicle_type] = row.count;
  }

  return snapshot;
}

/**
 * Create backup of database
 * @param {Object} db - Database connection (must support backup method)
 * @param {string} backupPath - Path for backup file
 */
function createBackup(db, backupPath) {
  console.log(`Creating database backup at: ${backupPath}`);
  db.backup(backupPath);
  console.log('✅ Backup created successfully');
}

module.exports = {
  normalizeModelName,
  generateSlug,
  levenshteinDistance,
  calculateSimilarity,
  detectDuplicates,
  selectPrimaryModel,
  countRelationships,
  migrateRelationships,
  deleteDuplicateModels,
  validateIntegrity,
  createSnapshot,
  createBackup
};
