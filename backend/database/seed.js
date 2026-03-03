require('dotenv').config();
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function seed() {
  // Seed categories
  const categories = [
    { name: 'Ilmu Komputer', description: 'Buku-buku tentang ilmu komputer dan teknologi informasi' },
    { name: 'Matematika', description: 'Buku-buku tentang matematika dan statistika' },
    { name: 'Ekonomi', description: 'Buku-buku tentang ekonomi dan bisnis' },
    { name: 'Hukum', description: 'Buku-buku tentang hukum dan perundang-undangan' },
    { name: 'Kedokteran', description: 'Buku-buku tentang ilmu kedokteran dan kesehatan' },
    { name: 'Teknik', description: 'Buku-buku tentang ilmu teknik' },
    { name: 'Sastra', description: 'Buku-buku sastra dan bahasa' },
    { name: 'Sejarah', description: 'Buku-buku sejarah dan sosial budaya' },
  ];

  for (const cat of categories) {
    await pool.query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
      [cat.name, cat.description]
    );
  }
  console.log('✔ Categories seeded');

  // Seed admin user
  const adminPassword = bcrypt.hashSync('admin123', 10);
  await pool.query(
    "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'admin') ON CONFLICT (email) DO NOTHING",
    ['Administrator', 'admin@unismu.ac.id', adminPassword]
  );
  console.log('✔ Admin user seeded  (email: admin@unismu.ac.id, password: admin123)');

  // Seed regular user
  const userPassword = bcrypt.hashSync('user123', 10);
  await pool.query(
    "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, 'user') ON CONFLICT (email) DO NOTHING",
    ['Mahasiswa Demo', 'mahasiswa@unismu.ac.id', userPassword]
  );
  console.log('✔ Demo user seeded   (email: mahasiswa@unismu.ac.id, password: user123)');

  // Seed sample books
  const books = [
    {
      title: 'Algoritma dan Pemrograman',
      author: 'Rinaldi Munir',
      isbn: '978-979-3368-30-0',
      category: 'Ilmu Komputer',
      description: 'Buku teks tentang algoritma dasar pemrograman komputer.',
      publisher: 'Informatika Bandung',
      year: 2016,
      available_copies: 5,
    },
    {
      title: 'Basis Data',
      author: 'Fathansyah',
      isbn: '978-602-6208-24-5',
      category: 'Ilmu Komputer',
      description: 'Konsep dan implementasi basis data relasional.',
      publisher: 'Informatika Bandung',
      year: 2018,
      available_copies: 4,
    },
    {
      title: 'Kalkulus Jilid 1',
      author: 'James Stewart',
      isbn: '978-979-691-232-9',
      category: 'Matematika',
      description: 'Pengantar kalkulus untuk mahasiswa sains dan teknik.',
      publisher: 'Erlangga',
      year: 2015,
      available_copies: 6,
    },
    {
      title: 'Ekonomi Mikro',
      author: 'Sadono Sukirno',
      isbn: '978-979-769-078-9',
      category: 'Ekonomi',
      description: 'Teori dasar ekonomi mikro untuk perguruan tinggi.',
      publisher: 'Raja Grafindo Persada',
      year: 2013,
      available_copies: 3,
    },
    {
      title: 'Hukum Perdata Indonesia',
      author: 'Subekti',
      isbn: '978-979-450-048-4',
      category: 'Hukum',
      description: 'Pokok-pokok hukum perdata di Indonesia.',
      publisher: 'PT Intermasa',
      year: 2014,
      available_copies: 2,
    },
    {
      title: 'Ilmu Bedah',
      author: 'Sjamsuhidajat',
      isbn: '978-979-448-736-4',
      category: 'Kedokteran',
      description: 'Referensi ilmu bedah untuk pendidikan kedokteran.',
      publisher: 'EGC',
      year: 2017,
      available_copies: 3,
    },
    {
      title: 'Mekanika Teknik',
      author: 'Ferdinand Beer',
      isbn: '978-979-691-463-7',
      category: 'Teknik',
      description: 'Prinsip-prinsip mekanika untuk insinyur.',
      publisher: 'Erlangga',
      year: 2016,
      available_copies: 4,
    },
  ];

  for (const book of books) {
    const catResult = await pool.query('SELECT id FROM categories WHERE name = $1', [book.category]);
    const categoryId = catResult.rows[0] ? catResult.rows[0].id : null;
    await pool.query(
      `INSERT INTO books (title, author, isbn, category_id, description, publisher, year, available_copies)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (isbn) DO NOTHING`,
      [book.title, book.author, book.isbn, categoryId, book.description, book.publisher, book.year, book.available_copies]
    );
  }
  console.log('✔ Sample books seeded');

  console.log('\n✅ Database seeding completed!');
  await pool.end();
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
