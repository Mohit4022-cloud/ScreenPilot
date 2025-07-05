import { EventEmitter } from 'events';
import crypto from 'crypto';

export interface CachedResult {
  hash: string;
  perceptualHash: string;
  analysis: any;
  timestamp: number;
  accessCount: number;
  lastAccessed: number;
  cost: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  totalSaved: number;
  costSaved: number;
  cacheSize: number;
}

export class GPT4OCache extends EventEmitter {
  private cache = new Map<string, CachedResult>();
  private perceptualIndex = new Map<string, string[]>(); // perceptual hash -> [exact hashes]
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    totalSaved: 0,
    costSaved: 0,
    cacheSize: 0
  };
  
  // Configuration
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly SIMILARITY_THRESHOLD = 5; // Hamming distance
  private readonly TTL_MS = 3600000; // 1 hour
  private readonly COST_PER_ANALYSIS = 0.001; // $0.001 per GPT-4o call

  async get(
    imageBuffer: Buffer,
    perceptualHash: string
  ): Promise<CachedResult | null> {
    // Try exact match first
    const exactHash = this.computeHash(imageBuffer);
    const exactResult = this.cache.get(exactHash);
    
    if (exactResult) {
      this.recordHit(exactResult);
      return exactResult;
    }
    
    // Try perceptual match
    const similarResult = this.findSimilar(perceptualHash);
    if (similarResult) {
      this.recordHit(similarResult);
      return similarResult;
    }
    
    this.stats.misses++;
    return null;
  }

  set(
    imageBuffer: Buffer,
    perceptualHash: string,
    analysis: any,
    cost: number = this.COST_PER_ANALYSIS
  ): void {
    const hash = this.computeHash(imageBuffer);
    
    // Check cache size limit
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLRU();
    }
    
    const cachedResult: CachedResult = {
      hash,
      perceptualHash,
      analysis,
      timestamp: Date.now(),
      accessCount: 1,
      lastAccessed: Date.now(),
      cost
    };
    
    this.cache.set(hash, cachedResult);
    
    // Update perceptual index
    if (!this.perceptualIndex.has(perceptualHash)) {
      this.perceptualIndex.set(perceptualHash, []);
    }
    this.perceptualIndex.get(perceptualHash)!.push(hash);
    
    this.stats.cacheSize = this.cache.size;
    this.emit('cached', { hash, perceptualHash });
  }

  private computeHash(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private findSimilar(targetHash: string): CachedResult | null {
    let bestMatch: CachedResult | null = null;
    let bestDistance = Infinity;
    
    // Check all perceptual hashes
    for (const [storedHash, exactHashes] of this.perceptualIndex) {
      const distance = this.hammingDistance(targetHash, storedHash);
      
      if (distance <= this.SIMILARITY_THRESHOLD && distance < bestDistance) {
        // Get the most recently used exact match
        const results = exactHashes
          .map(hash => this.cache.get(hash))
          .filter(Boolean) as CachedResult[];
        
        if (results.length > 0) {
          bestMatch = results.reduce((a, b) => 
            a.lastAccessed > b.lastAccessed ? a : b
          );
          bestDistance = distance;
        }
      }
    }
    
    return bestMatch;
  }

  private hammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) return Infinity;
    
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      if (hash1[i] !== hash2[i]) distance++;
    }
    
    return distance;
  }

  private recordHit(result: CachedResult): void {
    result.accessCount++;
    result.lastAccessed = Date.now();
    this.stats.hits++;
    this.stats.totalSaved++;
    this.stats.costSaved += result.cost;
    
    this.emit('hit', {
      hash: result.hash,
      savedCost: result.cost,
      totalSaved: this.stats.costSaved
    });
  }

  private evictLRU(): void {
    // Find least recently used entry
    let lruKey: string | null = null;
    let lruTime = Infinity;
    
    for (const [key, value] of this.cache) {
      // Also evict expired entries
      if (Date.now() - value.timestamp > this.TTL_MS) {
        this.removeEntry(key);
        return;
      }
      
      if (value.lastAccessed < lruTime) {
        lruTime = value.lastAccessed;
        lruKey = key;
      }
    }
    
    if (lruKey) {
      this.removeEntry(lruKey);
    }
  }

  private removeEntry(key: string): void {
    const entry = this.cache.get(key);
    if (!entry) return;
    
    this.cache.delete(key);
    
    // Update perceptual index
    const hashes = this.perceptualIndex.get(entry.perceptualHash);
    if (hashes) {
      const filtered = hashes.filter(h => h !== key);
      if (filtered.length > 0) {
        this.perceptualIndex.set(entry.perceptualHash, filtered);
      } else {
        this.perceptualIndex.delete(entry.perceptualHash);
      }
    }
    
    this.emit('evicted', { hash: key });
  }

  // Clear cache
  clear(): void {
    this.cache.clear();
    this.perceptualIndex.clear();
    this.stats.cacheSize = 0;
    this.emit('cleared');
  }

  // Get cache statistics
  getStats(): CacheStats {
    return { ...this.stats };
  }

  // Get hit rate
  getHitRate(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }

  // Prune expired entries
  pruneExpired(): number {
    const now = Date.now();
    let pruned = 0;
    
    for (const [key, value] of this.cache) {
      if (now - value.timestamp > this.TTL_MS) {
        this.removeEntry(key);
        pruned++;
      }
    }
    
    return pruned;
  }

  // Export cache for persistence
  export(): string {
    const data = {
      cache: Array.from(this.cache.entries()),
      perceptualIndex: Array.from(this.perceptualIndex.entries()),
      stats: this.stats
    };
    
    return JSON.stringify(data);
  }

  // Import cache from persistence
  import(data: string): void {
    try {
      const parsed = JSON.parse(data);
      
      this.cache = new Map(parsed.cache);
      this.perceptualIndex = new Map(parsed.perceptualIndex);
      this.stats = parsed.stats;
      
      // Prune expired entries
      this.pruneExpired();
      
      this.emit('imported', { size: this.cache.size });
    } catch (error) {
      console.error('Failed to import cache:', error);
    }
  }
}