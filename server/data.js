import { env } from './env.js'

/**
 * MedQueue Tashkent — in-memory data store.
 *
 * Demo-oriented seed data: real Tashkent districts, realistic clinic names
 * (polyclinics, hospitals and private clinics), doctors, live queues,
 * appointments, laboratory results and notifications for the demo patient.
 *
 * All human-readable fields carry { uz, ru, en } variants and are localized
 * through `pick(lang, obj)` — database values are never machine-translated.
 */

export const DEMO_PATIENT = {
  id: 'demo-patient',
  name: { uz: 'Aziza Karimova', ru: 'Азиза Каримова', en: 'Aziza Karimova' },
  phone: '+998 90 123 45 67',
  age: 32,
  bloodType: { uz: 'A (II) Rh+', ru: 'A (II) Rh+', en: 'A (II) Rh+' },
  primaryClinicId: 'c-6',
}

const LANG_CODES = ['uz', 'ru', 'en']

export function pick(lang, obj) {
  const code = LANG_CODES.includes(lang) ? lang : 'uz'
  return obj?.[code] ?? obj?.uz ?? ''
}

export const DISTRICTS = [
  { id: 'chilonzor', name: { uz: 'Chilonzor', ru: 'Чиланзар', en: 'Chilonzor' } },
  { id: 'yunusobod', name: { uz: 'Yunusobod', ru: 'Юнусабад', en: 'Yunusobod' } },
  { id: 'mirzo-ulugbek', name: { uz: "Mirzo Ulug'bek", ru: 'Мирзо-Улугбекский', en: 'Mirzo Ulugbek' } },
  { id: 'shayxontohur', name: { uz: 'Shayxontohur', ru: 'Шайхантахурский', en: 'Shayxontohur' } },
  { id: 'yakkasaroy', name: { uz: 'Yakkasaroy', ru: 'Яккасарайский', en: 'Yakkasaroy' } },
  { id: 'mirobod', name: { uz: 'Mirobod', ru: 'Мирабадский', en: 'Mirobod' } },
  { id: 'sergeli', name: { uz: 'Sergeli', ru: 'Сергелийский', en: 'Sergeli' } },
  { id: 'yashnobod', name: { uz: 'Yashnobod', ru: 'Яшнабадский', en: 'Yashnobod' } },
  { id: 'olmazor', name: { uz: 'Olmazor', ru: 'Алмазарский', en: 'Olmazor' } },
  { id: 'uchtepa', name: { uz: 'Uchtepa', ru: 'Учтепинский', en: 'Uchtepa' } },
  { id: 'bektemir', name: { uz: 'Bektemir', ru: 'Бектемирский', en: 'Bektemir' } },
]

export const SPECIALTIES = [
  { id: 'terapevt', name: { uz: 'Terapevt', ru: 'Терапевт', en: 'Therapist' } },
  { id: 'kardiolog', name: { uz: 'Kardiolog', ru: 'Кардиолог', en: 'Cardiologist' } },
  { id: 'pediatr', name: { uz: 'Pediatr', ru: 'Педиатр', en: 'Pediatrician' } },
  { id: 'dermatolog', name: { uz: 'Dermatolog', ru: 'Дерматолог', en: 'Dermatologist' } },
  { id: 'nevrolog', name: { uz: 'Nevrolog', ru: 'Невролог', en: 'Neurologist' } },
  { id: 'ginekolog', name: { uz: 'Ginekolog', ru: 'Гинеколог', en: 'Gynecologist' } },
  { id: 'lor', name: { uz: 'Lor (quloq-burun-tomoq)', ru: 'ЛОР', en: 'ENT' } },
  { id: 'oftalmolog', name: { uz: 'Oftalmolog', ru: 'Офтальмолог', en: 'Ophthalmologist' } },
  { id: 'stomatolog', name: { uz: 'Stomatolog', ru: 'Стоматолог', en: 'Dentist' } },
  { id: 'xirurg', name: { uz: 'Xirurg', ru: 'Хирург', en: 'Surgeon' } },
  { id: 'endokrinolog', name: { uz: 'Endokrinolog', ru: 'Эндокринолог', en: 'Endocrinologist' } },
  { id: 'urolog', name: { uz: 'Urolog', ru: 'Уролог', en: 'Urologist' } },
]

export const CLINIC_TYPES = [
  { id: 'polyclinic', name: { uz: 'Poliklinika', ru: 'Поликлиника', en: 'Polyclinic' } },
  { id: 'hospital', name: { uz: 'Kasalxona', ru: 'Больница', en: 'Hospital' } },
  { id: 'private', name: { uz: "Xususiy klinika", ru: 'Частная клиника', en: 'Private clinic' } },
]

const DIST = (id) => DISTRICTS.find((d) => d.id === id)
const SPEC = (id) => SPECIALTIES.find((s) => s.id === id)

export const CLINICS = [
  {
    id: 'c-1',
    type: 'polyclinic',
    district: 'chilonzor',
    address: { uz: 'Bunyodkor ko\'chasi, 45', ru: 'ул. Бунёдкор, 45', en: 'Bunyodkor St., 45' },
    phone: '+998 71 277 45 10',
    workStart: '08:00',
    workEnd: '20:00',
    name: { uz: 'Chilonzor 5-son poliklinika', ru: 'Поликлиника №5 Чиланзар', en: 'Chilonzor Polyclinic No.5' },
    specialties: ['terapevt', 'kardiolog', 'pediatr', 'nevrolog', 'lor', 'oftalmolog', 'ginekolog'],
    avgQueueMin: 18,
  },
  {
    id: 'c-2',
    type: 'polyclinic',
    district: 'chilonzor',
    address: { uz: 'Qatortol ko\'chasi, 12', ru: 'ул. Катортол, 12', en: 'Qatortol St., 12' },
    phone: '+998 71 277 52 30',
    workStart: '08:00',
    workEnd: '20:00',
    name: { uz: 'Chilonzor 12-son poliklinika', ru: 'Поликлиника №12 Чиланзар', en: 'Chilonzor Polyclinic No.12' },
    specialties: ['terapevt', 'pediatr', 'stomatolog', 'xirurg'],
    avgQueueMin: 15,
  },
  {
    id: 'c-3',
    type: 'hospital',
    district: 'chilonzor',
    address: { uz: 'Bunyodkor ko\'chasi, 18', ru: 'ул. Бунёдкор, 18', en: 'Bunyodkor St., 18' },
    phone: '+998 71 277 03 00',
    workStart: '08:00',
    workEnd: '18:00',
    name: { uz: 'Shahar klinik shoshilinch tibbiy yordam shifoxonasi', ru: 'Городская клиническая больница скорой помощи', en: 'City Clinical Emergency Hospital' },
    specialties: ['terapevt', 'kardiolog', 'xirurg', 'nevrolog', 'urolog'],
    avgQueueMin: 25,
  },
  {
    id: 'c-4',
    type: 'private',
    district: 'chilonzor',
    address: { uz: 'Chilonzor ko\'chasi, 100', ru: 'ул. Чиланзар, 100', en: 'Chilonzor St., 100' },
    phone: '+998 71 230 47 00',
    workStart: '09:00',
    workEnd: '21:00',
    name: { uz: 'MedLife Chilonzor', ru: 'MedLife Чиланзар', en: 'MedLife Chilonzor' },
    specialties: ['terapevt', 'kardiolog', 'dermatolog', 'ginekolog', 'endokrinolog', 'stomatolog'],
    avgQueueMin: 8,
  },
  {
    id: 'c-5',
    type: 'polyclinic',
    district: 'yunusobod',
    address: { uz: 'Amir Temur ko\'chasi, 140', ru: 'ул. Амира Темура, 140', en: 'Amir Temur St., 140' },
    phone: '+998 71 268 19 40',
    workStart: '08:00',
    workEnd: '20:00',
    name: { uz: 'Yunusobod 1-son poliklinika', ru: 'Поликлиника №1 Юнусабад', en: 'Yunusobod Polyclinic No.1' },
    specialties: ['terapevt', 'kardiolog', 'pediatr', 'nevrolog', 'endokrinolog'],
    avgQueueMin: 16,
  },
  {
    id: 'c-6',
    type: 'private',
    district: 'yunusobod',
    address: { uz: 'Bobur ko\'chasi, 8', ru: 'ул. Бабура, 8', en: 'Bobur St., 8' },
    phone: '+998 71 200 88 88',
    workStart: '08:30',
    workEnd: '22:00',
    name: { uz: 'MedQueue Medical Yunusobod', ru: 'MedQueue Medical Юнусабад', en: 'MedQueue Medical Yunusobod' },
    specialties: ['terapevt', 'kardiolog', 'dermatolog', 'ginekolog', 'lor', 'oftalmolog', 'urolog', 'endokrinolog'],
    avgQueueMin: 6,
  },
  {
    id: 'c-7',
    type: 'private',
    district: 'yunusobod',
    address: { uz: 'Shota Rustaveli ko\'chasi, 11', ru: 'ул. Шота Руставели, 11', en: 'Shota Rustaveli St., 11' },
    phone: '+998 71 250 33 22',
    workStart: '09:00',
    workEnd: '20:00',
    name: { uz: 'Biotex klinikasi', ru: 'Клиника Биотекс', en: 'Biotex Clinic' },
    specialties: ['dermatolog', 'nevrolog', 'endokrinolog', 'urolog'],
    avgQueueMin: 7,
  },
  {
    id: 'c-8',
    type: 'polyclinic',
    district: 'mirzo-ulugbek',
    address: { uz: 'Mirzo Ulug\'bek ko\'chasi, 45', ru: 'ул. Мирзо-Улугбека, 45', en: 'Mirzo Ulugbek St., 45' },
    phone: '+998 71 267 42 21',
    workStart: '08:00',
    workEnd: '20:00',
    name: { uz: 'Mirzo Ulug\'bek 2-son poliklinika', ru: 'Поликлиника №2 Мирзо-Улугбек', en: 'Mirzo Ulugbek Polyclinic No.2' },
    specialties: ['terapevt', 'pediatr', 'lor', 'oftalmolog', 'stomatolog', 'ginekolog'],
    avgQueueMin: 14,
  },
  {
    id: 'c-9',
    type: 'private',
    district: 'mirzo-ulugbek',
    address: { uz: 'Buyuk Ipak Yo\'li ko\'chasi, 44', ru: 'ул. Буюк Ипак Йули, 44', en: 'Buyuk Ipak Yoli St., 44' },
    phone: '+998 71 291 12 34',
    workStart: '09:00',
    workEnd: '21:00',
    name: { uz: 'Prima Medica', ru: 'Prima Medica', en: 'Prima Medica' },
    specialties: ['terapevt', 'kardiolog', 'dermatolog', 'ginekolog', 'stomatolog'],
    avgQueueMin: 9,
  },
  {
    id: 'c-10',
    type: 'hospital',
    district: 'mirzo-ulugbek',
    address: { uz: 'Kichik Halqa yo\'li, 5', ru: 'Малая кольцевая, 5', en: 'Kichik Halqa Rd., 5' },
    phone: '+998 71 269 00 77',
    workStart: '08:00',
    workEnd: '18:00',
    name: { uz: '1-son shahar klinik shifoxonasi', ru: 'Городская клиническая больница №1', en: 'City Clinical Hospital No.1' },
    specialties: ['terapevt', 'kardiolog', 'xirurg', 'nevrolog', 'urolog', 'oftalmolog'],
    avgQueueMin: 22,
  },
  {
    id: 'c-11',
    type: 'polyclinic',
    district: 'shayxontohur',
    address: { uz: 'Navoiy ko\'chasi, 30', ru: 'ул. Навои, 30', en: 'Navoiy St., 30' },
    phone: '+998 71 233 60 10',
    workStart: '08:00',
    workEnd: '20:00',
    name: { uz: 'Shayxontohur 4-son poliklinika', ru: 'Поликлиника №4 Шайхантахур', en: 'Shayxontohur Polyclinic No.4' },
    specialties: ['terapevt', 'kardiolog', 'pediatr', 'nevrolog', 'ginekolog'],
    avgQueueMin: 17,
  },
  {
    id: 'c-12',
    type: 'private',
    district: 'shayxontohur',
    address: { uz: 'Afrosiyob ko\'chasi, 12', ru: 'ул. Афросиаб, 12', en: 'Afrosiyob St., 12' },
    phone: '+998 71 232 44 55',
    workStart: '09:00',
    workEnd: '21:00',
    name: { uz: 'Tashkent City Clinic', ru: 'Tashkent City Clinic', en: 'Tashkent City Clinic' },
    specialties: ['terapevt', 'dermatolog', 'lor', 'oftalmolog', 'endokrinolog', 'stomatolog'],
    avgQueueMin: 5,
  },
  {
    id: 'c-13',
    type: 'hospital',
    district: 'shayxontohur',
    address: { uz: 'Farobiy ko\'chasi, 2', ru: 'ул. Фаробий, 2', en: 'Farobiy St., 2' },
    phone: '+998 71 235 90 00',
    workStart: '00:00',
    workEnd: '00:00',
    name: { uz: 'Respublika ixtisoslashtirilgan kardiologiya markazi', ru: 'Республиканский специализированный центр кардиологии', en: 'Republican Cardiology Center' },
    specialties: ['kardiolog'],
    avgQueueMin: 20,
  },
  {
    id: 'c-14',
    type: 'private',
    district: 'yakkasaroy',
    address: { uz: 'Yusuf Xos Hojib ko\'chasi, 51', ru: 'ул. Юсуфа Хос Хаджиба, 51', en: 'Yusuf Xos Hojib St., 51' },
    phone: '+998 71 246 77 88',
    workStart: '09:00',
    workEnd: '21:00',
    name: { uz: 'Family Health Clinic', ru: 'Family Health Clinic', en: 'Family Health Clinic' },
    specialties: ['terapevt', 'pediatr', 'dermatolog', 'ginekolog', 'nevrolog'],
    avgQueueMin: 6,
  },
  {
    id: 'c-15',
    type: 'polyclinic',
    district: 'yakkasaroy',
    address: { uz: 'Abdulla Qahhor ko\'chasi, 3', ru: 'ул. Абдуллы Каххара, 3', en: 'Abdulla Qahhor St., 3' },
    phone: '+998 71 246 11 22',
    workStart: '08:00',
    workEnd: '20:00',
    name: { uz: 'Yakkasaroy 8-son poliklinika', ru: 'Поликлиника №8 Яккасарай', en: 'Yakkasaroy Polyclinic No.8' },
    specialties: ['terapevt', 'pediatr', 'lor', 'stomatolog', 'xirurg'],
    avgQueueMin: 13,
  },
  {
    id: 'c-16',
    type: 'private',
    district: 'mirobod',
    address: { uz: 'Nukus ko\'chasi, 77', ru: 'ул. Нукус, 77', en: 'Nukus St., 77' },
    phone: '+998 71 120 55 66',
    workStart: '09:00',
    workEnd: '22:00',
    name: { uz: 'MedHub Tashkent', ru: 'MedHub Ташкент', en: 'MedHub Tashkent' },
    specialties: ['terapevt', 'kardiolog', 'dermatolog', 'nevrolog', 'endokrinolog', 'urolog', 'ginekolog'],
    avgQueueMin: 7,
  },
  {
    id: 'c-17',
    type: 'polyclinic',
    district: 'mirobod',
    address: { uz: 'Afrosiyob ko\'chasi, 12a', ru: 'ул. Афросиаб, 12а', en: 'Afrosiyob St., 12a' },
    phone: '+998 71 152 33 44',
    workStart: '08:00',
    workEnd: '20:00',
    name: { uz: 'Mirobod 17-son poliklinika', ru: 'Поликлиника №17 Мирабад', en: 'Mirobod Polyclinic No.17' },
    specialties: ['terapevt', 'pediatr', 'ginekolog', 'oftalmolog'],
    avgQueueMin: 12,
  },
  {
    id: 'c-18',
    type: 'polyclinic',
    district: 'sergeli',
    address: { uz: 'Sergeli ko\'chasi, 9', ru: 'ул. Сергели, 9', en: 'Sergeli St., 9' },
    phone: '+998 71 271 20 30',
    workStart: '08:00',
    workEnd: '20:00',
    name: { uz: 'Sergeli 9-son poliklinika', ru: 'Поликлиника №9 Сергели', en: 'Sergeli Polyclinic No.9' },
    specialties: ['terapevt', 'pediatr', 'stomatolog', 'lor'],
    avgQueueMin: 11,
  },
  {
    id: 'c-19',
    type: 'polyclinic',
    district: 'yashnobod',
    address: { uz: 'Yashnobod ko\'chasi, 21', ru: 'ул. Яшнабад, 21', en: 'Yashnobod St., 21' },
    phone: '+998 71 274 45 67',
    workStart: '08:00',
    workEnd: '20:00',
    name: { uz: 'Yashnobod 3-son oilaviy poliklinika', ru: 'Семейная поликлиника №3 Яшнабад', en: 'Yashnobod Family Polyclinic No.3' },
    specialties: ['terapevt', 'pediatr', 'nevrolog', 'endokrinolog'],
    avgQueueMin: 10,
  },
  {
    id: 'c-20',
    type: 'private',
    district: 'uchtepa',
    address: { uz: 'Kichik bekat ko\'chasi, 60', ru: 'ул. Кичик бекат, 60', en: 'Kichik bekat St., 60' },
    phone: '+998 71 290 90 90',
    workStart: '09:00',
    workEnd: '21:00',
    name: { uz: 'DoctorPlus Uchtepa', ru: 'DoctorPlus Учтепа', en: 'DoctorPlus Uchtepa' },
    specialties: ['terapevt', 'stomatolog', 'xirurg', 'urolog'],
    avgQueueMin: 8,
  },
  {
    id: 'c-21',
    type: 'hospital',
    district: 'yashnobod',
    address: { uz: 'Muqimiy ko\'chasi, 4', ru: 'ул. Мукими, 4', en: 'Muqimiy St., 4' },
    phone: '+998 71 278 60 00',
    workStart: '08:00',
    workEnd: '18:00',
    name: { uz: '3-son shahar klinik shifoxonasi', ru: 'Городская клиническая больница №3', en: 'City Clinical Hospital No.3' },
    specialties: ['terapevt', 'kardiolog', 'xirurg', 'nevrolog', 'urolog'],
    avgQueueMin: 21,
  },
  {
    id: 'c-22',
    type: 'private',
    district: 'sergeli',
    address: { uz: 'Bunyodkor ko\'chasi, 110', ru: 'ул. Бунёдкор, 110', en: 'Bunyodkor St., 110' },
    phone: '+998 71 288 40 40',
    workStart: '09:00',
    workEnd: '20:00',
    name: { uz: 'Lazur Medical', ru: 'Лазур Медикал', en: 'Lazur Medical' },
    specialties: ['dermatolog', 'ginekolog', 'kardiolog', 'endokrinolog'],
    avgQueueMin: 6,
  },
  {
    id: 'c-23',
    type: 'polyclinic',
    district: 'bektemir',
    address: { uz: 'Bektemir ko\'chasi, 2', ru: 'ул. Бектемир, 2', en: 'Bektemir St., 2' },
    phone: '+998 71 291 70 70',
    workStart: '08:00',
    workEnd: '20:00',
    name: { uz: 'Bektemir 1-son poliklinika', ru: 'Поликлиника №1 Бектемир', en: 'Bektemir Polyclinic No.1' },
    specialties: ['terapevt', 'pediatr', 'ginekolog', 'oftalmolog'],
    avgQueueMin: 12,
  },
  {
    id: 'c-24',
    type: 'private',
    district: 'olmazor',
    address: { uz: 'Farobiy ko\'chasi, 3', ru: 'ул. Фаробий, 3', en: 'Farobiy St., 3' },
    phone: '+998 71 246 55 00',
    workStart: '09:00',
    workEnd: '21:00',
    name: { uz: 'MedQueue Medical Olmazor', ru: 'MedQueue Medical Алмазар', en: 'MedQueue Medical Olmazor' },
    specialties: ['terapevt', 'dermatolog', 'nevrolog', 'oftalmolog', 'urolog', 'ginekolog'],
    avgQueueMin: 5,
  },
  {
    id: 'c-25',
    type: 'hospital',
    district: 'olmazor',
    address: { uz: 'Beruniy ko\'chasi, 10', ru: 'ул. Беруни, 10', en: 'Beruniy St., 10' },
    phone: '+998 71 246 80 00',
    workStart: '00:00',
    workEnd: '00:00',
    name: { uz: 'Respublika dermatologiya markazi', ru: 'Республиканский центр дерматологии', en: 'Republican Dermatology Center' },
    specialties: ['dermatolog'],
    avgQueueMin: 15,
  },
  /* Demo dental clinics — replaceable with real clinic data later. */
  {
    id: 'c-26',
    type: 'private',
    district: 'yunusobod',
    address: { uz: 'Amir Temur ko\'chasi, 129b', ru: 'ул. Амира Темура, 129б', en: 'Amir Temur St., 129b' },
    phone: '+998 71 289 07 07',
    workStart: '09:00',
    workEnd: '20:00',
    name: { uz: 'Smile Dental Yunusobod', ru: 'Smile Dental Юнусабад', en: 'Smile Dental Yunusobod' },
    specialties: ['stomatolog'],
    avgQueueMin: 5,
  },
  {
    id: 'c-27',
    type: 'private',
    district: 'chilonzor',
    address: { uz: 'Chilonzor ko\'chasi, 27', ru: 'ул. Чиланзар, 27', en: 'Chilonzor St., 27' },
    phone: '+998 71 230 61 61',
    workStart: '09:00',
    workEnd: '21:00',
    name: { uz: 'DentaLife Chilonzor', ru: 'DentaLife Чиланзар', en: 'DentaLife Chilonzor' },
    specialties: ['stomatolog', 'xirurg'],
    avgQueueMin: 4,
  },
  {
    id: 'c-28',
    type: 'private',
    district: 'mirzo-ulugbek',
    address: { uz: 'Buyuk Ipak Yo\'li ko\'chasi, 61', ru: 'ул. Буюк Ипак Йули, 61', en: 'Buyuk Ipak Yoli St., 61' },
    phone: '+998 71 296 82 82',
    workStart: '09:00',
    workEnd: '20:00',
    name: { uz: 'MedDent Mirzo Ulug\'bek', ru: 'MedDent Мирзо-Улугбек', en: 'MedDent Mirzo Ulugbek' },
    specialties: ['stomatolog'],
    avgQueueMin: 6,
  },
  {
    id: 'c-29',
    type: 'private',
    district: 'shayxontohur',
    address: { uz: 'Navoiy ko\'chasi, 27', ru: 'ул. Навои, 27', en: 'Navoiy St., 27' },
    phone: '+998 71 233 77 88',
    workStart: '09:00',
    workEnd: '19:00',
    name: { uz: 'Dental Care Shayxontohur', ru: 'Dental Care Шайхантахур', en: 'Dental Care Shayxontohur' },
    specialties: ['stomatolog', 'lor'],
    avgQueueMin: 7,
  },
  {
    id: 'c-30',
    type: 'private',
    district: 'sergeli',
    address: { uz: 'Yangihayot ko\'chasi, 4', ru: 'ул. Янгихаёт, 4', en: 'Yangihayot St., 4' },
    phone: '+998 71 277 31 31',
    workStart: '09:00',
    workEnd: '20:00',
    name: { uz: 'OralMed Sergeli', ru: 'OralMed Сергели', en: 'OralMed Sergeli' },
    specialties: ['stomatolog'],
    avgQueueMin: 5,
  },
]

const FIRST = ['Aziza', 'Dilnoza', 'Gulnora', 'Malika', 'Nodira', 'Shahnoza', 'Zarina', 'Olim', 'Jamshid', 'Rustam', 'Sardor', 'Timur', 'Bekzod', 'Ulug\'bek']
const LAST = ['Karimova', 'Rahimova', 'Yusupova', 'Aliyeva', 'Toshmatova', 'Ergasheva', 'Sobirova', 'Rahmonov', 'Ismoilov', 'Sharipov', 'Yuldashev', 'Nazarov', 'Abdullayev', 'Saidov']

let doctorCounter = 0
function makeDoctor(clinic, specialtyId, expRange, langRange, rating) {
  doctorCounter += 1
  const first = FIRST[doctorCounter % FIRST.length]
  const last = LAST[(doctorCounter * 3) % LAST.length]
  const langs = langRange.slice(0, 1 + (doctorCounter % langRange.length))
  const resolvedRating = rating ?? (4.2 + ((doctorCounter * 7) % 8) / 10)
  return {
    id: `d-${doctorCounter}`,
    clinicId: clinic.id,
    specialtyId,
    name: { uz: `${first} ${last}`, ru: `${first} ${last}`, en: `${first} ${last}` },
    experience: expRange[doctorCounter % expRange.length],
    rating: resolvedRating,
    reviews: 40 + ((doctorCounter * 17 + Math.round(resolvedRating * 10)) % 260),
    languages: langs,
    availableToday: (doctorCounter + clinic.id.length) % 5 !== 0,
    availableTomorrow: (doctorCounter + clinic.id.length) % 7 !== 0,
  }
}

export const DOCTORS = (() => {
  const doctors = []
  const bySpec = (clinicId, spec) => CLINICS.find((c) => c.id === clinicId)?.specialties.includes(spec)
  const add = (clinicId, specId, exp, langs, rating) => {
    const clinic = CLINICS.find((c) => c.id === clinicId)
    if (!clinic || !bySpec(clinicId, specId)) return
    doctors.push(makeDoctor(clinic, specId, exp, langs, rating))
  }

  add('c-1', 'terapevt', [7, 15, 22], ['uz', 'ru'], 4.8)
  add('c-1', 'kardiolog', [12, 20], ['uz', 'ru', 'en'], 4.9)
  add('c-1', 'pediatr', [8, 14], ['uz', 'ru'], 4.7)
  add('c-1', 'lor', [6, 18], ['uz', 'ru'], 4.6)
  add('c-1', 'nevrolog', [10, 16], ['uz', 'ru', 'en'], 4.8)
  add('c-2', 'terapevt', [5, 12, 25], ['uz', 'ru'], 4.5)
  add('c-2', 'pediatr', [9, 17], ['uz', 'ru'], 4.6)
  add('c-2', 'stomatolog', [7, 13], ['uz', 'ru', 'en'], 4.4)
  add('c-2', 'xirurg', [11, 19], ['uz', 'ru'], 4.5)
  add('c-3', 'terapevt', [9, 21], ['uz', 'ru'], 4.6)
  add('c-3', 'kardiolog', [14, 26], ['uz', 'ru', 'en'], 4.9)
  add('c-3', 'xirurg', [16, 24], ['uz', 'ru'], 4.8)
  add('c-3', 'nevrolog', [13, 23], ['uz', 'ru'], 4.7)
  add('c-4', 'terapevt', [6, 12], ['uz', 'ru', 'en'], 4.8)
  add('c-4', 'kardiolog', [15, 18], ['uz', 'ru', 'en'], 4.9)
  add('c-4', 'dermatolog', [8, 14], ['uz', 'ru', 'en'], 4.7)
  add('c-4', 'ginekolog', [10, 16], ['uz', 'ru'], 4.8)
  add('c-4', 'endokrinolog', [9, 15], ['uz', 'ru', 'en'], 4.6)
  add('c-5', 'terapevt', [8, 20], ['uz', 'ru'], 4.5)
  add('c-5', 'kardiolog', [12, 22], ['uz', 'ru'], 4.8)
  add('c-5', 'pediatr', [7, 13], ['uz', 'ru'], 4.7)
  add('c-5', 'nevrolog', [11, 17], ['uz', 'ru', 'en'], 4.6)
  add('c-6', 'terapevt', [7, 14], ['uz', 'ru', 'en'], 4.9)
  add('c-6', 'kardiolog', [13, 25], ['uz', 'ru', 'en'], 4.9)
  add('c-6', 'dermatolog', [9, 16], ['uz', 'ru', 'en'], 4.8)
  add('c-6', 'ginekolog', [12, 18], ['uz', 'ru', 'en'], 4.9)
  add('c-6', 'lor', [6, 11], ['uz', 'ru'], 4.6)
  add('c-6', 'urolog', [14, 20], ['uz', 'ru', 'en'], 4.7)
  add('c-7', 'dermatolog', [10, 19], ['uz', 'ru'], 4.6)
  add('c-7', 'nevrolog', [12, 21], ['uz', 'ru', 'en'], 4.7)
  add('c-7', 'endokrinolog', [8, 15], ['uz', 'ru'], 4.5)
  add('c-8', 'terapevt', [6, 16], ['uz', 'ru'], 4.4)
  add('c-8', 'pediatr', [8, 12], ['uz', 'ru'], 4.6)
  add('c-8', 'lor', [5, 14], ['uz', 'ru'], 4.5)
  add('c-8', 'oftalmolog', [9, 17], ['uz', 'ru'], 4.6)
  add('c-8', 'stomatolog', [7, 12], ['uz', 'ru'], 4.5)
  add('c-9', 'terapevt', [9, 18], ['uz', 'ru', 'en'], 4.7)
  add('c-9', 'kardiolog', [16, 24], ['uz', 'ru', 'en'], 4.8)
  add('c-9', 'dermatolog', [8, 13], ['uz', 'ru', 'en'], 4.6)
  add('c-9', 'ginekolog', [11, 19], ['uz', 'ru'], 4.7)
  add('c-10', 'kardiolog', [18, 28], ['uz', 'ru'], 4.9)
  add('c-10', 'xirurg', [15, 27], ['uz', 'ru'], 4.8)
  add('c-10', 'nevrolog', [14, 22], ['uz', 'ru'], 4.7)
  add('c-10', 'urolog', [12, 20], ['uz', 'ru'], 4.6)
  add('c-11', 'terapevt', [7, 15], ['uz', 'ru'], 4.4)
  add('c-11', 'kardiolog', [13, 21], ['uz', 'ru'], 4.7)
  add('c-11', 'pediatr', [8, 16], ['uz', 'ru'], 4.5)
  add('c-11', 'ginekolog', [9, 18], ['uz', 'ru'], 4.6)
  add('c-12', 'terapevt', [6, 11], ['uz', 'ru', 'en'], 4.8)
  add('c-12', 'dermatolog', [7, 12], ['uz', 'ru', 'en'], 4.7)
  add('c-12', 'lor', [5, 9], ['uz', 'ru', 'en'], 4.5)
  add('c-12', 'oftalmolog', [8, 14], ['uz', 'ru', 'en'], 4.7)
  add('c-12', 'endokrinolog', [10, 16], ['uz', 'ru', 'en'], 4.6)
  add('c-13', 'kardiolog', [15, 22, 30], ['uz', 'ru', 'en'], 5.0)
  add('c-14', 'terapevt', [8, 17], ['uz', 'ru', 'en'], 4.7)
  add('c-14', 'pediatr', [9, 15], ['uz', 'ru'], 4.8)
  add('c-14', 'dermatolog', [11, 18], ['uz', 'ru', 'en'], 4.6)
  add('c-14', 'ginekolog', [10, 20], ['uz', 'ru'], 4.7)
  add('c-14', 'nevrolog', [13, 19], ['uz', 'ru'], 4.6)
  add('c-15', 'terapevt', [7, 13], ['uz', 'ru'], 4.3)
  add('c-15', 'pediatr', [8, 14], ['uz', 'ru'], 4.5)
  add('c-15', 'lor', [6, 12], ['uz', 'ru'], 4.4)
  add('c-15', 'stomatolog', [9, 15], ['uz', 'ru'], 4.6)
  add('c-15', 'xirurg', [12, 18], ['uz', 'ru'], 4.5)
  add('c-16', 'terapevt', [7, 14], ['uz', 'ru', 'en'], 4.9)
  add('c-16', 'kardiolog', [12, 20], ['uz', 'ru', 'en'], 4.9)
  add('c-16', 'dermatolog', [9, 15], ['uz', 'ru', 'en'], 4.7)
  add('c-16', 'nevrolog', [11, 19], ['uz', 'ru', 'en'], 4.8)
  add('c-16', 'endokrinolog', [10, 17], ['uz', 'ru', 'en'], 4.7)
  add('c-16', 'urolog', [13, 21], ['uz', 'ru', 'en'], 4.8)
  add('c-17', 'terapevt', [6, 12], ['uz', 'ru'], 4.4)
  add('c-17', 'pediatr', [7, 13], ['uz', 'ru'], 4.5)
  add('c-17', 'ginekolog', [9, 15], ['uz', 'ru'], 4.6)
  add('c-17', 'oftalmolog', [8, 14], ['uz', 'ru'], 4.5)
  add('c-18', 'terapevt', [5, 11], ['uz', 'ru'], 4.3)
  add('c-18', 'pediatr', [7, 12], ['uz', 'ru'], 4.4)
  add('c-18', 'stomatolog', [6, 13], ['uz', 'ru'], 4.5)
  add('c-18', 'lor', [5, 10], ['uz', 'ru'], 4.4)
  add('c-19', 'terapevt', [8, 16], ['uz', 'ru'], 4.5)
  add('c-19', 'pediatr', [9, 17], ['uz', 'ru'], 4.6)
  add('c-19', 'nevrolog', [10, 18], ['uz', 'ru'], 4.5)
  add('c-19', 'endokrinolog', [11, 16], ['uz', 'ru'], 4.6)
  add('c-20', 'terapevt', [6, 12], ['uz', 'ru'], 4.5)
  add('c-20', 'stomatolog', [8, 14], ['uz', 'ru'], 4.6)
  add('c-20', 'xirurg', [10, 17], ['uz', 'ru'], 4.6)
  add('c-20', 'urolog', [11, 18], ['uz', 'ru'], 4.5)
  add('c-21', 'terapevt', [9, 19], ['uz', 'ru'], 4.5)
  add('c-21', 'kardiolog', [14, 23], ['uz', 'ru'], 4.8)
  add('c-21', 'xirurg', [15, 25], ['uz', 'ru'], 4.7)
  add('c-21', 'nevrolog', [12, 21], ['uz', 'ru'], 4.6)
  add('c-22', 'dermatolog', [8, 15], ['uz', 'ru', 'en'], 4.7)
  add('c-22', 'ginekolog', [10, 17], ['uz', 'ru', 'en'], 4.8)
  add('c-22', 'kardiolog', [13, 20], ['uz', 'ru', 'en'], 4.8)
  add('c-22', 'endokrinolog', [9, 16], ['uz', 'ru', 'en'], 4.6)
  add('c-23', 'terapevt', [6, 12], ['uz', 'ru'], 4.3)
  add('c-23', 'pediatr', [7, 13], ['uz', 'ru'], 4.4)
  add('c-23', 'ginekolog', [9, 15], ['uz', 'ru'], 4.5)
  add('c-23', 'oftalmolog', [8, 14], ['uz', 'ru'], 4.4)
  add('c-24', 'terapevt', [8, 15], ['uz', 'ru', 'en'], 4.8)
  add('c-24', 'dermatolog', [9, 16], ['uz', 'ru', 'en'], 4.7)
  add('c-24', 'nevrolog', [11, 18], ['uz', 'ru', 'en'], 4.7)
  add('c-24', 'oftalmolog', [10, 17], ['uz', 'ru', 'en'], 4.6)
  add('c-24', 'urolog', [12, 19], ['uz', 'ru', 'en'], 4.7)
  add('c-25', 'dermatolog', [10, 20], ['uz', 'ru'], 4.6)

  /* Demo dentists (high-rated) at the dedicated dental clinics. */
  add('c-26', 'stomatolog', [12, 19, 24], ['uz', 'ru', 'en'], 4.9)
  add('c-26', 'stomatolog', [8, 15], ['uz', 'ru', 'en'], 4.7)
  add('c-27', 'stomatolog', [10, 17, 22], ['uz', 'ru', 'en'], 4.8)
  add('c-27', 'stomatolog', [7, 13], ['uz', 'ru'], 4.6)
  add('c-28', 'stomatolog', [14, 21, 27], ['uz', 'ru', 'en'], 4.9)
  add('c-28', 'stomatolog', [9, 16], ['uz', 'ru', 'en'], 4.7)
  add('c-29', 'stomatolog', [11, 18, 25], ['uz', 'ru', 'en'], 4.8)
  add('c-29', 'stomatolog', [6, 12], ['uz', 'ru'], 4.5)
  add('c-30', 'stomatolog', [9, 14, 20], ['uz', 'ru'], 4.6)
  add('c-30', 'stomatolog', [5, 10], ['uz', 'ru'], 4.4)

  return doctors
})()

/**
 * Queue state per doctor. `current` is the number currently being served,
 * `lastIssued` the last handed-out number, `patients` are people waiting
 * (only the demo patient gets a persistent number; others are simulated).
 */
export const QUEUES = new Map(
  DOCTORS.map((doctor, i) => [
    doctor.id,
    {
      doctorId: doctor.id,
      letter: String.fromCharCode(65 + (i % 5)),
      current: 100 + ((i * 13) % 30),
      lastIssued: 100 + ((i * 13) % 30) + 4 + (i % 6),
      patients: [],
      updatedAt: Date.now(),
    },
  ])
)

// Seed the demo patient into the cardiologist queue (d-2) so the dashboard
// shows a live queue out of the box.
{
  const seed = QUEUES.get('d-2')
  if (seed) {
    seed.lastIssued += 5
    seed.patients.push({ patientId: DEMO_PATIENT.id, number: seed.lastIssued - 5, joinedAt: Date.now() })
  }
}

export const APPOINTMENTS = [
  {
    id: 'ap-1',
    patientId: DEMO_PATIENT.id,
    doctorId: 'd-2',
    clinicId: 'c-1',
    specialtyId: 'kardiolog',
    date: 'today',
    time: '15:30',
    status: 'upcoming',
    createdAt: Date.now() - 86400000 * 2,
  },
  {
    id: 'ap-2',
    patientId: DEMO_PATIENT.id,
    doctorId: 'd-25',
    clinicId: 'c-9',
    specialtyId: 'terapevt',
    date: 'tomorrow',
    time: '10:00',
    status: 'upcoming',
    createdAt: Date.now() - 86400000,
  },
  {
    id: 'ap-3',
    patientId: DEMO_PATIENT.id,
    doctorId: 'd-3',
    clinicId: 'c-1',
    specialtyId: 'pediatr',
    date: 'past',
    time: '09:00',
    status: 'completed',
    createdAt: Date.now() - 86400000 * 14,
  },
  {
    id: 'ap-4',
    patientId: DEMO_PATIENT.id,
    doctorId: 'd-20',
    clinicId: 'c-8',
    specialtyId: 'oftalmolog',
    date: 'past',
    time: '11:30',
    status: 'completed',
    createdAt: Date.now() - 86400000 * 30,
  },
]

export const LAB_RESULTS = [
  {
    id: 'lab-1',
    patientId: DEMO_PATIENT.id,
    title: { uz: 'Umumiy qon tahlili', ru: 'Общий анализ крови', en: 'Complete blood count' },
    date: 'today',
    status: 'ready',
    summary: {
      uz: 'Gemoglobin 128 g/l, eritrotsitlar 4.6×10¹²/l, leykotsitlar 6.1×10⁹/l, trombotsitlar 240×10⁹/l — ko\'rsatkichlar me\'yorida.',
      ru: 'Гемоглобин 128 г/л, эритроциты 4,6×10¹²/л, лейкоциты 6,1×10⁹/л, тромбоциты 240×10⁹/л — показатели в норме.',
      en: 'Hemoglobin 128 g/L, RBC 4.6×10¹²/L, WBC 6.1×10⁹/L, platelets 240×10⁹/L — within normal range.',
    },
  },
  {
    id: 'lab-2',
    patientId: DEMO_PATIENT.id,
    title: { uz: 'Qon zardobidagi glyukoza', ru: 'Глюкоза сыворотки крови', en: 'Blood glucose' },
    date: 'yesterday',
    status: 'ready',
    summary: {
      uz: 'Och qoringa glyukoza 5.2 mmol/l — me\'yorda (3.3–5.5 mmol/l).',
      ru: 'Глюкоза натощак 5,2 ммоль/л — в норме (3,3–5,5 ммоль/л).',
      en: 'Fasting glucose 5.2 mmol/L — normal (3.3–5.5 mmol/L).',
    },
  },
  {
    id: 'lab-3',
    patientId: DEMO_PATIENT.id,
    title: { uz: 'Qalqonsimon bez gormonlari (TSH)', ru: 'Тиреотропный гормон (ТТГ)', en: 'Thyroid stimulating hormone (TSH)' },
    date: 'future',
    status: 'pending',
    summary: null,
  },
]

export const NOTIFICATIONS = [
  {
    id: 'n-1',
    patientId: DEMO_PATIENT.id,
    type: 'queue_approaching',
    title: { uz: 'Navbatingiz yaqinlashmoqda', ru: 'Ваша очередь приближается', en: 'Your turn is approaching' },
    body: {
      uz: 'Kardiologga navbatingizga 3 kishi qoldi.',
      ru: 'До вашей очереди к кардиологу осталось 3 человека.',
      en: '3 people until your turn with the cardiologist.',
    },
    createdAt: Date.now() - 1000 * 60 * 12,
    read: false,
  },
  {
    id: 'n-2',
    patientId: DEMO_PATIENT.id,
    type: 'lab_ready',
    title: { uz: 'Laboratoriya natijasi tayyor', ru: 'Результат лаборатории готов', en: 'Laboratory result is ready' },
    body: {
      uz: 'Umumiy qon tahlili natijasi tayyor. Ko\'rish uchun bosing.',
      ru: 'Результат общего анализа крови готов. Нажмите, чтобы посмотреть.',
      en: 'Your complete blood count result is ready. Click to view.',
    },
    createdAt: Date.now() - 1000 * 60 * 60 * 3,
    read: false,
  },
  {
    id: 'n-3',
    patientId: DEMO_PATIENT.id,
    type: 'appointment_reminder',
    title: { uz: 'Eslatma: shifokor qabuli', ru: 'Напоминание: приём врача', en: 'Reminder: doctor appointment' },
    body: {
      uz: 'Ertaga 15:30 da kardiolog qabuli. Kechikmaslikka harakat qiling.',
      ru: 'Завтра в 15:30 приём кардиолога. Постарайтесь не опаздывать.',
      en: 'Cardiologist appointment tomorrow at 15:30. Please arrive on time.',
    },
    createdAt: Date.now() - 1000 * 60 * 60 * 26,
    read: true,
  },
]

const HISTORY_ITEMS = [
  {
    id: 'h-1',
    patientId: DEMO_PATIENT.id,
    type: 'visit',
    title: { uz: 'Kardiolog ko\'rigi', ru: 'Осмотр кардиолога', en: 'Cardiologist visit' },
    date: 'past-14d',
    summary: {
      uz: 'EKG, qon bosimi 120/80. Tavsiya: muntazam jismoniy faollik.',
      ru: 'ЭКГ, давление 120/80. Рекомендация: регулярная физическая активность.',
      en: 'ECG, blood pressure 120/80. Recommendation: regular physical activity.',
    },
  },
  {
    id: 'h-2',
    patientId: DEMO_PATIENT.id,
    type: 'lab',
    title: { uz: 'Laboratoriya: umumiy qon tahlili', ru: 'Лаборатория: общий анализ крови', en: 'Laboratory: complete blood count' },
    date: 'past-30d',
    summary: {
      uz: 'Barcha ko\'rsatkichlar me\'yorida.',
      ru: 'Все показатели в норме.',
      en: 'All indicators within normal range.',
    },
  },
  {
    id: 'h-3',
    patientId: DEMO_PATIENT.id,
    type: 'visit',
    title: { uz: 'Oftalmolog ko\'rigi', ru: 'Осмотр офтальмолога', en: 'Ophthalmologist visit' },
    date: 'past-30d',
    summary: {
      uz: 'Ko\'rish o\'tkirligi 1.0/1.0. Davolash talab etilmaydi.',
      ru: 'Острота зрения 1,0/1,0. Лечение не требуется.',
      en: 'Visual acuity 1.0/1.0. No treatment required.',
    },
  },
  {
    id: 'h-4',
    patientId: DEMO_PATIENT.id,
    type: 'vaccine',
    title: { uz: 'Grippga qarshi emlash', ru: 'Прививка от гриппа', en: 'Flu vaccination' },
    date: 'past-60d',
    summary: {
      uz: 'Mavsumiy grippga qarshi emlash amalga oshirildi.',
      ru: 'Проведена сезонная вакцинация от гриппа.',
      en: 'Seasonal flu vaccination administered.',
    },
  },
]

/** How long one person takes in the queue (minutes), for wait estimates. */
const MIN_PER_PERSON = 5

export function getPatient() {
  return { ...DEMO_PATIENT, name: pick('uz', DEMO_PATIENT.name) }
}

export function listSpecialties(lang = 'uz') {
  return SPECIALTIES.map((s) => ({ id: s.id, name: pick(lang, s.name) }))
}

export function listDistricts(lang = 'uz') {
  return DISTRICTS.map((d) => ({ id: d.id, name: pick(lang, d.name) }))
}

export function listClinicTypes(lang = 'uz') {
  return CLINIC_TYPES.map((t) => ({ id: t.id, name: pick(lang, t.name) }))
}

function norm(q) {
  return q.toLowerCase().replace(/[ʻ’`']/g, "'").trim()
}

/**
 * Filler words ignored during search, so natural-language queries like
 * "Bugun Chilonzorda terapevt bormi?" still match. Kept small and explicit.
 */
const SEARCH_STOPWORDS = new Set([
  'bugun', 'ertaga', 'kecha', 'hozir', 'hozirda',
  'bormi', 'borni', 'bormikan', 'bor', 'yoq', 'top', 'toping', 'topaman',
  'kerak', 'kerakmi', 'istayman', 'istaymiz', 'so\'ray', 'so\'rayman',
  'qidir', 'qidiring', 'qidiryapman', 'qidirish', 'qidirmoq',
  'qabul', 'qabulga', 'yozilmoqchi', 'yozilmoqchiman', 'yozilish', 'olish',
  'bilan', 'uchun', 'menga', 'mendan', 'men', 'man', 'qilaman', 'qila',
  'bo\'lsa', 'bo\'lsin', 'ayting', 'ayt', 'bering', 'ber', 'ko\'rsat',
  'kuni', 'kun', 'soat', 'vaqt', 'ham',
  'the', 'a', 'an', 'and', 'or', 'for', 'with', 'in', 'on', 'at', 'to', 'of',
  'is', 'are', 'there', 'today', 'tomorrow', 'yesterday', 'now',
  'please', 'show', 'find', 'need', 'want', 'looking', 'look', 'give',
  'в', 'на', 'за', 'по', 'к', 'с', 'у', 'о', 'и', 'а', 'но', 'же',
  'есть', 'нужен', 'нужна', 'нужно', 'найти', 'найди', 'найду', 'найдите',
  'искать', 'ищу', 'ищите', 'сегодня', 'завтра', 'вчера', 'сейчас',
  'приём', 'прием', 'записаться', 'записаться к',
  'какой', 'какая', 'какие', 'какого', 'где', 'как', 'мне', 'меня', 'можно',
])

/**
 * Common Uzbek case/plural suffixes stripped from query tokens so that
 * "chilonzorda", "kardiologga", "terapevtlardan" match base forms.
 */
const UZ_SUFFIXES = [
  'lardan', 'larda', 'larga', 'larning', 'ning', 'dagi', 'dan', 'ga', 'ka',
  'da', 'ni', 'lar', 'dek', 'cha', 'day', 'imiz', 'ingiz',
]

/** Russian case/adjectival endings (applied to Cyrillic tokens only). */
const RU_SUFFIXES = [
  'ский', 'ская', 'ское', 'ские', 'ском', 'ской', 'скому', 'ского',
  'ого', 'его', 'ому', 'ему', 'ых', 'их', 'ами', 'ями', 'ам', 'ям',
  'ах', 'ях', 'ом', 'ой', 'ем', 'ую', 'юю', 'ов', 'ев', 'а', 'я', 'е',
  'у', 'ю', 'ы', 'и', 'о', 'ь',
]

/**
 * Common spelling variants (Cyrillic-ized Uzbek forms etc.) mapped to the
 * canonical transliteration, so "олмазаре" still finds "Алмазарский".
 */
const SEARCH_ALIASES = {
  olmazar: 'almazar',
  olmazor: 'almazar',
}

/** Minimal Cyrillic→Latin transliteration for search tokens. */
const CYRILLIC_TO_LATIN = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ъ: '', ы: 'i', ь: '', э: 'e', ю: 'yu', я: 'ya', ў: 'u',
  қ: 'q', ғ: 'g', ҳ: 'h',
}

function transliterate(token) {
  let out = ''
  for (const ch of token.toLowerCase()) {
    out += CYRILLIC_TO_LATIN[ch] ?? ch
  }
  return out
}

function searchToken(raw) {
  let token = norm(raw).replace(/[.,!?;:"«»()[]{}#@]/g, '')
  if (!token || SEARCH_STOPWORDS.has(token)) return null
  const cyrillic = /[а-яёўқғҳ]/i.test(token)
  const suffixes = cyrillic ? RU_SUFFIXES : UZ_SUFFIXES
  for (const suffix of suffixes) {
    if (token.endsWith(suffix) && token.length - suffix.length >= 4) {
      token = token.slice(0, -suffix.length)
      break
    }
  }
  if (cyrillic) token = transliterate(token)
  if (token.length >= 4 && SEARCH_ALIASES[token]) token = SEARCH_ALIASES[token]
  return token || null
}

function searchParts(query) {
  const parts = []
  for (const word of norm(query).split(/\s+/)) {
    const token = searchToken(word)
    if (token) parts.push(token)
  }
  return parts
}

function searchHaystack(fields) {
  const tokens = new Set()
  for (const value of fields) {
    const token = searchToken(value)
    if (token) tokens.add(token)
    for (const word of norm(value).split(/\s+/)) {
      const t = searchToken(word)
      if (t) tokens.add(t)
    }
  }
  return tokens
}

/** Loose token match: exact, shared prefix, or containment (min 4 chars). */
function tokenMatches(part, token) {
  if (part === token) return true
  if (part.length < 4 || token.length < 4) return false
  return (
    token.startsWith(part) ||
    part.startsWith(token) ||
    token.includes(part) ||
    part.includes(token)
  )
}

/**
 * Search fields across ALL three languages so a query written in any of
 * them (or a mixed city-style query) still matches; display stays localized.
 */
function clinicHaystack(clinic, lang) {
  const fields = []
  for (const code of ['uz', 'ru', 'en']) {
    fields.push(pick(code, clinic.name), pick(code, DIST(clinic.district).name))
  }
  fields.push(pick(lang, clinic.address))
  fields.push(...clinic.specialties.map((s) => pick(lang, SPEC(s).name)))
  return searchHaystack(fields)
}

function doctorHaystack(doctor, _lang) {
  const clinic = CLINICS.find((c) => c.id === doctor.clinicId)
  const fields = []
  for (const code of ['uz', 'ru', 'en']) {
    fields.push(
      pick(code, doctor.name),
      pick(code, SPEC(doctor.specialtyId).name),
      pick(code, clinic.name),
      pick(code, DIST(clinic.district).name)
    )
  }
  return searchHaystack(fields)
}

/** Free-text search over clinics (name + district + address + specialty names). */
export function searchClinics(query, lang = 'uz') {
  const parts = searchParts(query)
  if (parts.length === 0) return CLINICS.map((c) => toClinic(c, lang))
  const matches = CLINICS.filter((clinic) => {
    const haystack = clinicHaystack(clinic, lang)
    return parts.every((part) =>
      Array.from(haystack).some((token) => tokenMatches(part, token))
    )
  })
  return matches.map((c) => toClinic(c, lang))
}

/** Free-text search over doctors (name + specialty + clinic + district). */
export function searchDoctors(query, lang = 'uz') {
  const parts = searchParts(query)
  if (parts.length === 0) return DOCTORS.map((d) => toDoctor(d, lang))
  const matches = DOCTORS.filter((doctor) => {
    const haystack = doctorHaystack(doctor, lang)
    return parts.every((part) =>
      Array.from(haystack).some((token) => tokenMatches(part, token))
    )
  })
  return matches.map((d) => toDoctor(d, lang))
}

export function toClinic(clinic, lang = 'uz') {
  const district = DIST(clinic.district)
  const type = CLINIC_TYPES.find((t) => t.id === clinic.type)
  const queueNow = clinic.specialties.reduce((sum, specId) => {
    const doctors = DOCTORS.filter((d) => d.clinicId === clinic.id && d.specialtyId === specId)
    return (
      sum +
      doctors.reduce((s, d) => {
        const q = QUEUES.get(d.id)
        return s + Math.max(0, q.lastIssued - q.current)
      }, 0)
    )
  }, 0)
  return {
    id: clinic.id,
    type: clinic.type,
    typeName: pick(lang, type.name),
    name: pick(lang, clinic.name),
    district: pick(lang, district.name),
    districtId: clinic.district,
    address: pick(lang, clinic.address),
    phone: clinic.phone,
    workHours: `${clinic.workStart}–${clinic.workEnd}`,
    specialties: clinic.specialties.map((s) => ({
      id: s,
      name: pick(lang, SPEC(s).name),
    })),
    queueNow,
    avgQueueMin: clinic.avgQueueMin,
  }
}

export function toDoctor(doctor, lang = 'uz') {
  const clinic = CLINICS.find((c) => c.id === doctor.clinicId)
  const queue = QUEUES.get(doctor.id)
  return {
    id: doctor.id,
    name: pick(lang, doctor.name),
    specialtyId: doctor.specialtyId,
    specialty: pick(lang, SPEC(doctor.specialtyId).name),
    clinicId: clinic.id,
    clinic: pick(lang, clinic.name),
    district: pick(lang, DIST(clinic.district).name),
    districtId: clinic.district,
    address: pick(lang, clinic.address),
    experience: doctor.experience,
    rating: doctor.rating,
    reviews: doctor.reviews,
    languages: doctor.languages,
    availableToday: doctor.availableToday,
    availableTomorrow: doctor.availableTomorrow,
    queueAhead: Math.max(0, queue.lastIssued - queue.current),
    queueLetter: queue.letter,
    avgWaitMin: Math.max(0, queue.lastIssued - queue.current) * MIN_PER_PERSON,
  }
}

export function getClinic(id, lang = 'uz') {
  const clinic = CLINICS.find((c) => c.id === id)
  return clinic ? toClinic(clinic, lang) : null
}

export function getDoctor(id, lang = 'uz') {
  const doctor = DOCTORS.find((d) => d.id === id)
  return doctor ? toDoctor(doctor, lang) : null
}

/* ------------------------- Dentist discovery ------------------------- */

/** Specialty used for dentist search (stomatolog / dentistry). */
export const DENTIST_SPECIALTY_ID = 'stomatolog'

/**
 * Configurable ranking weights for "eng zo'r / best" dentist mode.
 * Each weight is applied to a 0..1 normalized criterion score.
 */
export const DENTIST_RANK = {
  rating: 0.4,
  reviews: 0.2,
  experience: 0.2,
  availability: 0.1,
  wait: 0.1,
}

const RANK_MODES = new Set(['best', 'rating', 'experience', 'wait', 'availability'])

function dentistScore(doctor) {
  const { rating, reviews, experience, availability, wait } = DENTIST_RANK
  const ratingScore = doctor.rating / 5
  const reviewsScore = Math.min(1, doctor.reviews / 300)
  const experienceScore = Math.min(1, doctor.experience / 30)
  const availabilityScore = doctor.availableToday ? 1 : doctor.availableTomorrow ? 0.5 : 0
  const waitScore = 1 - Math.min(1, doctor.avgWaitMin / 60)
  return (
    rating * ratingScore +
    reviews * reviewsScore +
    experience * experienceScore +
    availability * availabilityScore +
    wait * waitScore
  )
}

function rankDentists(list, mode) {
  const sorted = [...list]
  if (mode === 'rating') {
    sorted.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews)
  } else if (mode === 'experience') {
    sorted.sort((a, b) => b.experience - a.experience)
  } else if (mode === 'wait') {
    sorted.sort((a, b) => a.avgWaitMin - b.avgWaitMin || b.rating - a.rating)
  } else if (mode === 'availability') {
    sorted.sort(
      (a, b) => Number(b.availableToday) - Number(a.availableToday) || dentistScore(b) - dentistScore(a)
    )
  } else {
    sorted.sort((a, b) => dentistScore(b) - dentistScore(a) || b.rating - a.rating)
  }
  return sorted.map((d) => ({ ...d, score: mode === 'best' ? Number(dentistScore(d).toFixed(3)) : undefined }))
}

/**
 * Extract district ids mentioned in a free-text query (all languages).
 * Uses the same tolerant tokenizer as the clinic/doctor search.
 */
export function matchDistrictIds(text) {
  const parts = searchParts(text)
  if (parts.length === 0) return []
  const found = []
  for (const district of DISTRICTS) {
    const tokens = searchHaystack([
      pick('uz', district.name),
      pick('ru', district.name),
      pick('en', district.name),
    ])
    const hit = parts.some((part) =>
      Array.from(tokens).some((token) => tokenMatches(part, token))
    )
    if (hit) found.push(district.id)
  }
  return found
}

/**
 * Ranked dentist search over the real MedQueue doctor store.
 *
 * @param {object} [filters]
 * @param {string} [filters.district] - District id to restrict to.
 * @param {number} [filters.ratingMin] - Minimum rating (0..5).
 * @param {boolean} [filters.availableToday] - Only dentists with slots today.
 * @param {boolean} [filters.availableTomorrow] - Only dentists with slots tomorrow.
 * @param {number} [filters.maxWaitMin] - Max estimated waiting time in minutes.
 * @param {string} [filters.rank] - 'best' (weighted) | 'rating' | 'experience' | 'wait' | 'availability'.
 * @param {number} [filters.limit] - Max results (default 5).
 * @param {string} [lang]
 * @returns {{ dentists: Array, rank: string, total: number }}
 */
export function searchDentists(filters = {}, lang = 'uz') {
  const {
    district = '',
    ratingMin = 0,
    availableToday = false,
    availableTomorrow = false,
    maxWaitMin = Infinity,
    rank = 'best',
    limit = 5,
  } = filters
  const mode = RANK_MODES.has(rank) ? rank : 'best'

  const base = DOCTORS.filter((d) => d.specialtyId === DENTIST_SPECIALTY_ID).map((d) =>
    toDoctor(d, lang)
  )

  const matched = base.filter((d) => {
    if (district && d.districtId !== district) return false
    if (ratingMin > 0 && d.rating < ratingMin) return false
    if (availableToday && !d.availableToday) return false
    if (availableTomorrow && !d.availableTomorrow) return false
    if (Number.isFinite(maxWaitMin) && d.avgWaitMin > maxWaitMin) return false
    return true
  })

  const dentists = rankDentists(matched, mode).slice(0, limit)
  return { dentists, rank: mode, total: matched.length }
}

/** Localized note explaining how the dentist ranking was produced. */
export function dentistRankNote(lang = 'uz', mode = 'best') {
  const base = {
    uz: 'Natijalar MedQueue ma\'lumotlaridagi reyting, sharhlar, tajriba, mavjudlik va navbat holati asosida tartiblandi.',
    ru: 'Результаты отсортированы по данным MedQueue: рейтинг, отзывы, опыт, доступность и очередь.',
    en: 'Results ranked using MedQueue data: rating, reviews, experience, availability and queue status.',
  }
  const byMode = {
    rating: {
      uz: 'Stomatologlar eng yuqori reyting va sharhlar soni bo\'yicha tartiblandi.',
      ru: 'Стоматологи отсортированы по самому высокому рейтингу и числу отзывов.',
      en: 'Dentists ranked by the highest rating and number of reviews.',
    },
    experience: {
      uz: 'Stomatologlar tajriba yillari bo\'yicha tartiblandi.',
      ru: 'Стоматологи отсортированы по годам опыта.',
      en: 'Dentists ranked by years of experience.',
    },
    wait: {
      uz: 'Stomatologlar eng qisqa kutish vaqti bo\'yicha tartiblandi.',
      ru: 'Стоматологи отсортированы по самому короткому времени ожидания.',
      en: 'Dentists ranked by the shortest waiting time.',
    },
    availability: {
      uz: 'Avval bugun qabul bor stomatologlar ko\'rsatilgan.',
      ru: 'Сначала показаны стоматологи с приёмом сегодня.',
      en: 'Dentists with availability today are shown first.',
    },
  }
  return byMode[mode]?.[lang] ?? base[lang]
}

export function getQueueStatus(doctorId, patientId = DEMO_PATIENT.id, lang = 'uz') {
  const doctor = DOCTORS.find((d) => d.id === doctorId)
  if (!doctor) return null
  const clinic = CLINICS.find((c) => c.id === doctor.clinicId)
  const queue = QUEUES.get(doctor.id)
  const entry = queue.patients.find((p) => p.patientId === patientId)

  const ahead = entry ? Math.max(0, entry.number - queue.current - 1) : null
  const served = entry ? queue.current >= entry.number : null

  return {
    doctorId,
    doctor: pick(lang, doctor.name),
    specialty: pick(lang, SPEC(doctor.specialtyId).name),
    clinicId: clinic.id,
    clinic: pick(lang, clinic.name),
    district: pick(lang, DIST(clinic.district).name),
    letter: queue.letter,
    current: queue.current,
    yourNumber: entry ? `${queue.letter}-${entry.number}` : null,
    peopleAhead: ahead,
    waitMin: ahead == null ? null : ahead * MIN_PER_PERSON,
    status: served ? 'served' : entry ? 'waiting' : 'not_in_queue',
    updatedAt: queue.updatedAt,
  }
}

export function takeQueue(doctorId, patientId = DEMO_PATIENT.id, lang = 'uz', options = {}) {
  const { date = 'today', time = 'now', source = 'website' } = options ?? {}
  const doctor = DOCTORS.find((d) => d.id === doctorId)
  if (!doctor) return null
  const queue = QUEUES.get(doctor.id)
  const existing = queue.patients.find((p) => p.patientId === patientId)
  if (existing) return getQueueStatus(doctorId, patientId, lang)

  queue.lastIssued += 1
  queue.patients.push({ patientId, number: queue.lastIssued, joinedAt: Date.now() })
  queue.updatedAt = Date.now()

  const clinic = CLINICS.find((c) => c.id === doctor.clinicId)
  const appointment = {
    id: `ap-${Date.now()}`,
    patientId,
    doctorId,
    clinicId: clinic.id,
    specialtyId: doctor.specialtyId,
    date,
    time,
    appointmentDate: date,
    appointmentTime: time,
    queueNumber: `${queue.letter}-${queue.lastIssued}`,
    status: 'confirmed',
    source,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  APPOINTMENTS.unshift(appointment)
  NOTIFICATIONS.unshift({
    id: `n-${Date.now()}`,
    patientId,
    type: 'queue_started',
    title: {
      uz: 'Navbatga qo\'shildingiz',
      ru: 'Вы встали в очередь',
      en: 'You joined the queue',
    },
    body: {
      uz: `${queue.letter}-${queue.lastIssued} raqamli navbat olindi. ${pick(lang, clinic.name)}`,
      ru: `Вы получили номер ${queue.letter}-${queue.lastIssued}. ${pick(lang, clinic.name)}`,
      en: `Queue number ${queue.letter}-${queue.lastIssued}. ${pick(lang, clinic.name)}`,
    },
    createdAt: Date.now(),
    read: false,
  })

  return { ...getQueueStatus(doctorId, patientId, lang), queueNumber: appointment.queueNumber }
}

/**
 * Remove the patient from a doctor's queue (and the matching "queue"
 * appointment). Returns the updated status — status becomes 'not_in_queue'
 * when the patient was not waiting anyway.
 */
export function cancelQueue(doctorId, patientId = DEMO_PATIENT.id, lang = 'uz') {
  const doctor = DOCTORS.find((d) => d.id === doctorId)
  if (!doctor) return null
  const queue = QUEUES.get(doctor.id)
  const index = queue.patients.findIndex((p) => p.patientId === patientId)
  if (index !== -1) {
    queue.patients.splice(index, 1)
    queue.updatedAt = Date.now()
  }
  const appIndex = APPOINTMENTS.findIndex(
    (a) => a.patientId === patientId && a.doctorId === doctorId && a.status !== 'cancelled'
  )
  if (appIndex !== -1) {
    APPOINTMENTS[appIndex].status = 'cancelled'
    APPOINTMENTS[appIndex].updatedAt = Date.now()
  }
  NOTIFICATIONS.unshift({
    id: `n-${Date.now()}`,
    patientId,
    type: 'queue_cancelled',
    title: {
      uz: 'Navbat bekor qilindi',
      ru: 'Очередь отменена',
      en: 'Queue cancelled',
    },
    body: {
      uz: `${pick(lang, doctor.name)} navbatidan chiqdingiz.`,
      ru: `Вы вышли из очереди к ${pick(lang, doctor.name)}.`,
      en: `You left the queue for ${pick(lang, doctor.name)}.`,
    },
    createdAt: Date.now(),
    read: false,
  })
  return getQueueStatus(doctorId, patientId, lang)
}

/** Map internal appointment statuses to the display set used by the UI. */
function displayStatus(status) {
  if (status === 'cancelled' || status === 'no_show') return 'cancelled'
  if (status === 'completed') return 'completed'
  if (status === 'called') return 'queue'
  return 'upcoming' // waiting | confirmed | legacy upcoming/queue
}

export function listAppointments(patientId = DEMO_PATIENT.id, lang = 'uz') {
  return APPOINTMENTS.filter((a) => a.patientId === patientId).map((a) => {
    const doctor = DOCTORS.find((d) => d.id === a.doctorId)
    const clinic = CLINICS.find((c) => c.id === a.clinicId)
    return {
      id: a.id,
      patientId: a.patientId,
      doctorId: a.doctorId,
      doctor: doctor ? pick(lang, doctor.name) : '',
      specialty: a.specialtyId ? pick(lang, SPEC(a.specialtyId).name) : '',
      clinic: clinic ? pick(lang, clinic.name) : '',
      district: clinic ? pick(lang, DIST(clinic.district).name) : '',
      date: a.date,
      time: a.time,
      appointmentDate: a.appointmentDate ?? a.date,
      appointmentTime: a.appointmentTime ?? a.time,
      queueNumber: a.queueNumber ?? null,
      source: a.source ?? 'website',
      status: displayStatus(a.status),
      statusRaw: a.status,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt ?? a.createdAt,
    }
  })
}

export function getAppointment(id, lang = 'uz') {
  const a = APPOINTMENTS.find((x) => x.id === id)
  if (!a) return null
  return listAppointments(a.patientId, lang).find((x) => x.id === id) ?? null
}

/** Valid internal appointment statuses (admin/queue transitions). */
const APPOINTMENT_STATUSES = new Set([
  'waiting',
  'confirmed',
  'called',
  'completed',
  'cancelled',
  'no_show',
])

/**
 * Change an appointment's status from the shared backend. Returns the
 * updated appointment plus a localized notification payload so the caller
 * can forward it to the user (website SSE + Telegram).
 */
export function updateAppointmentStatus(id, status, lang = 'uz') {
  const a = APPOINTMENTS.find((x) => x.id === id)
  if (!a) return null
  if (!APPOINTMENT_STATUSES.has(status)) return { error: 'invalid_status' }
  a.status = status
  a.updatedAt = Date.now()

  const doctor = DOCTORS.find((d) => d.id === a.doctorId)
  const clinic = CLINICS.find((c) => c.id === a.clinicId)
  const labels = {
    confirmed: { uz: 'Navbatingiz tasdiqlandi', ru: 'Ваша очередь подтверждена', en: 'Your queue is confirmed' },
    called: { uz: 'Navbatingiz keldi', ru: 'Ваша очередь подошла', en: 'Your turn has come' },
    completed: { uz: 'Qabul yakunlandi', ru: 'Приём завершён', en: 'Appointment completed' },
    cancelled: { uz: 'Navbat bekor qilindi', ru: 'Очередь отменена', en: 'Queue cancelled' },
    no_show: { uz: 'Qabulga kelmadingiz', ru: 'Вы не пришли', en: 'No show' },
  }
  if (labels[status]) {
    NOTIFICATIONS.unshift({
      id: `n-${Date.now()}`,
      patientId: a.patientId,
      type: `appointment_${status}`,
      title: labels[status],
      body: {
        uz: `${pick(lang, doctor.name)} — ${pick(lang, clinic.name)}, navbat ${a.queueNumber ?? ''}`.trim(),
        ru: `${pick(lang, doctor.name)} — ${pick(lang, clinic.name)}, очередь ${a.queueNumber ?? ''}`.trim(),
        en: `${pick(lang, doctor.name)} — ${pick(lang, clinic.name)}, number ${a.queueNumber ?? ''}`.trim(),
      },
      createdAt: Date.now(),
      read: false,
    })
  }

  const updated = getAppointment(id, lang)
  const telegramBody =
    status === 'called' || status === 'completed' || status === 'confirmed' || status === 'cancelled'
      ? {
          uz: `${labels[status].uz}!\n\n${updated.doctor} — ${updated.clinic}\nNavbat: ${updated.queueNumber ?? updated.time}`,
          ru: `${labels[status].ru}!\n\n${updated.doctor} — ${updated.clinic}\nОчередь: ${updated.queueNumber ?? updated.time}`,
          en: `${labels[status].en}!\n\n${updated.doctor} — ${updated.clinic}\nNumber: ${updated.queueNumber ?? updated.time}`,
        }
      : null
  return { appointment: updated, notification: telegramBody }
}

/**
 * Available appointment time slots for a doctor on a date. Slots are derived
 * from the clinic's real working hours; slots already taken by this doctor
 * on that date are excluded. Returns null when the doctor does not exist.
 */
export function getAvailableSlots(doctorId, date = 'today', lang = 'uz') {
  const doctor = DOCTORS.find((d) => d.id === doctorId)
  if (!doctor) return null
  const clinic = CLINICS.find((c) => c.id === doctor.clinicId)
  const [startH, startM] = (clinic.workStart ?? '09:00').split(':').map(Number)
  const [endH, endM] = (clinic.workEnd ?? '18:00').split(':').map(Number)
  const taken = new Set(
    APPOINTMENTS.filter((a) => a.doctorId === doctorId && (a.appointmentDate ?? a.date) === date)
      .map((a) => a.appointmentTime)
      .filter((x) => typeof x === 'string' && x.includes(':'))
  )
  const slots = []
  for (let h = startH, m = startM; h * 60 + m < endH * 60 + endM; ) {
    const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    if (!taken.has(time)) slots.push(time)
    m += 30
    if (m >= 60) {
      m -= 60
      h += 1
    }
  }
  return { doctorId, date, clinic: pick(lang, clinic.name), slots }
}

export function listLabResults(patientId = DEMO_PATIENT.id, lang = 'uz') {
  return LAB_RESULTS.filter((r) => r.patientId === patientId).map((r) => ({
    id: r.id,
    title: pick(lang, r.title),
    date: r.date,
    status: r.status,
    summary: r.summary ? pick(lang, r.summary) : null,
  }))
}

export function listNotifications(patientId = DEMO_PATIENT.id, lang = 'uz') {
  return NOTIFICATIONS.filter((n) => n.patientId === patientId).map((n) => ({
    id: n.id,
    type: n.type,
    title: pick(lang, n.title),
    body: pick(lang, n.body),
    createdAt: n.createdAt,
    read: n.read,
  }))
}

export function listMedicalHistory(patientId = DEMO_PATIENT.id, lang = 'uz') {
  return HISTORY_ITEMS.filter((h) => h.patientId === patientId).map((h) => ({
    id: h.id,
    type: h.type,
    title: pick(lang, h.title),
    date: h.date,
    summary: pick(lang, h.summary),
  }))
}

export function getDashboard(patientId = DEMO_PATIENT.id, lang = 'uz') {
  const activeQueue = []
  for (const doctor of DOCTORS) {
    const entry = QUEUES.get(doctor.id).patients.find((p) => p.patientId === patientId)
    if (entry) {
      activeQueue.push(getQueueStatus(doctor.id, patientId, lang))
    }
  }
  return {
    patient: patientSummary(patientId, lang),
    activeQueue,
    appointments: listAppointments(patientId, lang).filter(
      (a) => a.status === 'upcoming' || a.status === 'queue'
    ),
    labResults: listLabResults(patientId, lang),
    history: listMedicalHistory(patientId, lang),
    notifications: listNotifications(patientId, lang),
  }
}

/**
 * Neutral profile summary for authenticated users (their personal data lives
 * in the auth store, not in the demo medical store). The demo patient keeps
 * its rich seeded profile for the public demo surface.
 */
function patientSummary(patientId, lang) {
  if (!patientId.startsWith('user-')) {
    return {
      ...DEMO_PATIENT,
      name: pick(lang, DEMO_PATIENT.name),
      bloodType: pick(lang, DEMO_PATIENT.bloodType),
      primaryClinic: clinicName(patientId, lang),
    }
  }
  return { id: patientId, name: '', phone: '', age: null, bloodType: '', primaryClinic: '' }
}

function clinicName(patientId, lang) {
  const clinic = CLINICS.find((c) => c.id === DEMO_PATIENT.primaryClinicId)
  return clinic ? pick(lang, clinic.name) : ''
}

export function countTotalQueues() {
  let total = 0
  let servedToday = 0
  for (const queue of QUEUES.values()) {
    total += Math.max(0, queue.lastIssued - queue.current)
    servedToday += queue.current - 100
  }
  return { total, servedToday }
}

/** Advance every queue one step. Returns lifecycle events for notifications. */
export function tickQueues() {
  const events = []
  for (const queue of QUEUES.values()) {
    if (queue.current < queue.lastIssued) {
      queue.current += 1
      queue.updatedAt = Date.now()
    }
    for (const entry of queue.patients) {
      const doctor = DOCTORS.find((d) => d.id === queue.doctorId)
      const appointment = APPOINTMENTS.find(
        (a) =>
          a.patientId === entry.patientId &&
          a.doctorId === queue.doctorId &&
          (a.status === 'waiting' || a.status === 'confirmed')
      )
      if (!appointment) continue
      const ahead = entry.number - queue.current
      if (ahead === 3 && appointment.status !== 'called') {
        events.push({
          type: 'approaching',
          patientId: entry.patientId,
          doctorId: queue.doctorId,
          body: {
            uz: `Navbatingizga ${ahead} kishi qoldi.\n${pick('uz', doctor.name)} — navbat ${queue.letter}-${entry.number}`,
            ru: `До вашей очереди осталось ${ahead} человек.\n${pick('ru', doctor.name)} — очередь ${queue.letter}-${entry.number}`,
            en: `${ahead} people until your turn.\n${pick('en', doctor.name)} — number ${queue.letter}-${entry.number}`,
          },
        })
      } else if (ahead === 0 && appointment.status !== 'called') {
        appointment.status = 'called'
        appointment.updatedAt = Date.now()
        events.push({
          type: 'called',
          patientId: entry.patientId,
          doctorId: queue.doctorId,
          body: {
            uz: `Navbatingiz keldi!\n${pick('uz', doctor.name)} — qabulga kiring. Navbat ${queue.letter}-${entry.number}`,
            ru: `Ваша очередь подошла!\n${pick('ru', doctor.name)} — пройдите на приём. Очередь ${queue.letter}-${entry.number}`,
            en: `Your turn has come!\n${pick('en', doctor.name)} — proceed to the appointment. Number ${queue.letter}-${entry.number}`,
          },
        })
      } else if (ahead < 0 && appointment.status === 'called') {
        appointment.status = 'completed'
        appointment.updatedAt = Date.now()
        events.push({
          type: 'completed',
          patientId: entry.patientId,
          doctorId: queue.doctorId,
          body: {
            uz: `Qabul yakunlandi.\n${pick('uz', doctor.name)} — navbat ${queue.letter}-${entry.number}`,
            ru: `Приём завершён.\n${pick('ru', doctor.name)} — очередь ${queue.letter}-${entry.number}`,
            en: `Appointment completed.\n${pick('en', doctor.name)} — number ${queue.letter}-${entry.number}`,
          },
        })
      }
    }
  }
  return events
}

export function getQueueStateAll() {
  const out = {}
  for (const queue of QUEUES.values()) {
    out[queue.doctorId] = {
      letter: queue.letter,
      current: queue.current,
      lastIssued: queue.lastIssued,
      updatedAt: queue.updatedAt,
    }
  }
  return out
}

export const TICK_MS = Number(env('MEDQUEUE_TICK_MS', '30000'))

let ticker = null
export function startQueueTicker(fn) {
  if (ticker) return ticker
  ticker = setInterval(() => {
    const events = tickQueues()
    if (fn) fn(events)
  }, TICK_MS)
  return ticker
}

export function stopQueueTicker() {
  if (ticker) {
    clearInterval(ticker)
    ticker = null
  }
}

/* ------------------------------------------------------------------ */
/* Telegram account linking                                            */
/* ------------------------------------------------------------------ */

/**
 * One website account = one Telegram account. Linking uses a one-time
 * code ("MQ-123456") generated on the website and entered in the bot.
 * The Telegram user id is the primary identity, never the username.
 */
const telegramAccounts = new Map() // telegramUserId (string) -> account
const telegramLinkCodes = new Map() // code -> { userId, expiresAt }

const TELEGRAM_LINK_TTL_MS = 15 * 60 * 1000

/** Patient id used for authenticated website/Telegram users. */
export function patientIdForUser(userId) {
  return `user-${userId}`
}

function publicTelegramAccount(account) {
  if (!account) return null
  return {
    id: account.id,
    userId: account.userId,
    telegramUserId: account.telegramUserId,
    telegramUsername: account.telegramUsername ?? null,
    isVerified: account.isVerified,
    createdAt: account.createdAt,
  }
}

/** Generate a fresh one-time linking code for a website user. */
export function createTelegramLinkCode(userId) {
  for (const [code, entry] of telegramLinkCodes) {
    if (entry.userId === userId) telegramLinkCodes.delete(code)
  }
  const code = `MQ-${Math.floor(100000 + Math.random() * 900000)}`
  telegramLinkCodes.set(code, { userId, expiresAt: Date.now() + TELEGRAM_LINK_TTL_MS })
  return { code, expiresInSec: Math.floor(TELEGRAM_LINK_TTL_MS / 1000) }
}

/**
 * Verify a linking code entered in the Telegram bot. On success the
 * Telegram account is attached to the website user (previous links of
 * both sides are removed — one account per user and per telegram id).
 */
export function verifyTelegramLink(code, telegramUserId, telegramUsername = '') {
  const normalizedCode = String(code ?? '').trim().toUpperCase()
  const entry = telegramLinkCodes.get(normalizedCode)
  if (!entry || entry.expiresAt <= Date.now()) {
    if (entry) telegramLinkCodes.delete(normalizedCode)
    return { ok: false, code: 'invalid_code' }
  }
  telegramLinkCodes.delete(normalizedCode)

  const tid = String(telegramUserId)
  for (const [key, account] of telegramAccounts) {
    if (key === tid || account.userId === entry.userId) telegramAccounts.delete(key)
  }
  const account = {
    id: `tg-${entry.userId}`,
    userId: entry.userId,
    telegramUserId: tid,
    telegramUsername: typeof telegramUsername === 'string' ? telegramUsername : '',
    isVerified: true,
    createdAt: Date.now(),
  }
  telegramAccounts.set(tid, account)
  return { ok: true, account: publicTelegramAccount(account) }
}

/** Linked Telegram account for a website user id (or null). */
export function getTelegramByUserId(userId) {
  for (const account of telegramAccounts.values()) {
    if (account.userId === userId) return publicTelegramAccount(account)
  }
  return null
}

/** Website user id linked to a Telegram user id (or null). */
export function getUserIdByTelegram(telegramUserId) {
  const account = telegramAccounts.get(String(telegramUserId))
  return account ? account.userId : null
}

/** Telegram chat id (private chat == telegram user id) of a website user. */
export function getTelegramChatIdByUserId(userId) {
  for (const [tid, account] of telegramAccounts) {
    if (account.userId === userId) return tid
  }
  return null
}

/** Remove the Telegram link of a website user. */
export function unlinkTelegram(userId) {
  for (const [tid, account] of telegramAccounts) {
    if (account.userId === userId) {
      telegramAccounts.delete(tid)
      return true
    }
  }
  return false
}