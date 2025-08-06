#!/usr/bin/env node

/**
 * Migration script to move existing local images to Cloudflare R2
 * 
 * Usage: node scripts/migrateToR2.js [--dry-run] [--type=dish|restaurant|all]
 * 
 * --dry-run: Show what would be migrated without actually doing it
 * --type: Specify which type of images to migrate (default: all)
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs/promises';
import path from 'path';
import pool from '../db.js';
import r2Storage from '../services/r2Storage.js';
import { logger } from '../services/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const uploadsDir = join(__dirname, '..', 'uploads');

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const typeArg = args.find(arg => arg.startsWith('--type='));
const migrationType = typeArg ? typeArg.split('=')[1] : 'all';

class R2Migrator {
  constructor() {
    this.stats = {
      total: 0,
      migrated: 0,
      skipped: 0,
      errors: 0,
      updated: 0
    };
  }

  async migrate() {
    console.log('🚀 Starting R2 Migration...');
    console.log(`📝 Mode: ${isDryRun ? 'DRY RUN' : 'LIVE MIGRATION'}`);
    console.log(`📂 Type: ${migrationType}`);
    console.log('');

    // Check R2 configuration
    if (!r2Storage.isConfigured()) {
      console.error('❌ R2 storage is not properly configured');
      console.error('Please check your R2 environment variables:');
      console.error('- R2_ACCESS_KEY_ID');
      console.error('- R2_SECRET_ACCESS_KEY');
      console.error('- R2_ENDPOINT');
      console.error('- R2_BUCKET_NAME');
      process.exit(1);
    }

    try {
      // Migrate based on type
      if (migrationType === 'all' || migrationType === 'restaurant') {
        await this.migrateRestaurantLogos();
      }
      
      if (migrationType === 'all' || migrationType === 'dish') {
        await this.migrateDishImages();
      }

      // Print final stats
      this.printStats();

    } catch (error) {
      console.error('💥 Migration failed:', error);
      process.exit(1);
    }
  }

  async migrateRestaurantLogos() {
    console.log('🏪 Migrating restaurant logos...');
    
    try {
      const restaurants = await pool.query(`
        SELECT id, name, image_url 
        FROM restaurants 
        WHERE image_url IS NOT NULL 
        AND image_url LIKE '/uploads/restaurant_logos/%'
      `);

      for (const restaurant of restaurants.rows) {
        await this.migrateImage(
          restaurant,
          'restaurant_logos',
          'restaurant',
          'restaurants',
          'image_url'
        );
      }

    } catch (error) {
      console.error('Error migrating restaurant logos:', error);
      this.stats.errors++;
    }
  }

  async migrateDishImages() {
    console.log('🍽️ Migrating dish images...');
    
    try {
      const dishes = await pool.query(`
        SELECT id, name, image_url 
        FROM dishes 
        WHERE image_url IS NOT NULL 
        AND image_url LIKE '/uploads/dish_images/%'
      `);

      for (const dish of dishes.rows) {
        await this.migrateImage(
          dish,
          'dish_images',
          'dish',
          'dishes',
          'image_url'
        );
      }

    } catch (error) {
      console.error('Error migrating dish images:', error);
      this.stats.errors++;
    }
  }

  async migrateImage(record, folderName, imageType, tableName, urlColumn) {
    this.stats.total++;
    
    const imageUrl = record[urlColumn];
    const filename = path.basename(imageUrl);
    const localPath = join(uploadsDir, folderName, filename);

    console.log(`📷 Processing ${record.name}: ${filename}`);

    try {
      // Check if local file exists
      await fs.access(localPath);
    } catch (error) {
      console.log(`  ⚠️  Local file not found: ${localPath}`);
      this.stats.skipped++;
      return;
    }

    if (isDryRun) {
      console.log(`  🔍 Would migrate: ${localPath} -> R2`);
      this.stats.migrated++;
      return;
    }

    try {
      // Migrate to R2
      const result = await r2Storage.migrateLocalImage(localPath, imageType);
      
      if (result.success) {
        // Update database with new R2 URL
        await pool.query(
          `UPDATE ${tableName} SET ${urlColumn} = $1 WHERE id = $2`,
          [result.url, record.id]
        );

        console.log(`  ✅ Migrated to: ${result.url}`);
        this.stats.migrated++;
        this.stats.updated++;

        // Optionally remove local file after successful migration
        // await fs.unlink(localPath);
        // console.log(`  🗑️  Removed local file: ${localPath}`);
        
      } else {
        console.log(`  ❌ Migration failed for ${filename}`);
        this.stats.errors++;
      }

    } catch (error) {
      console.log(`  ❌ Error migrating ${filename}:`, error.message);
      this.stats.errors++;
    }
  }

  printStats() {
    console.log('');
    console.log('📊 Migration Statistics:');
    console.log(`  Total images processed: ${this.stats.total}`);
    console.log(`  Successfully migrated: ${this.stats.migrated}`);
    console.log(`  Database records updated: ${this.stats.updated}`);
    console.log(`  Skipped (file not found): ${this.stats.skipped}`);
    console.log(`  Errors: ${this.stats.errors}`);
    
    if (isDryRun) {
      console.log('');
      console.log('🔍 This was a dry run. No actual changes were made.');
      console.log('Run without --dry-run to perform the actual migration.');
    } else if (this.stats.errors === 0) {
      console.log('');
      console.log('🎉 Migration completed successfully!');
    } else {
      console.log('');
      console.log('⚠️  Migration completed with some errors. Please review the logs above.');
    }
  }
}

// Run migration
const migrator = new R2Migrator();
migrator.migrate().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});