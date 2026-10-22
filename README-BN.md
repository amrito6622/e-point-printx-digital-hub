# E-Point & Printx Digital Hub — বুকিং সিস্টেম

এটি একটি Node.js + Express + SQLite ভিত্তিক starter project। এতে রয়েছে:
- কাস্টমার রেজিস্ট্রেশন/লগইন এবং নিজের বুকিং দেখা
- অ্যাডমিন লগইন, সব বুকিং দেখা, স্ট্যাটাস বদলানো, রাইডার বরাদ্দ, নোট ও মেরামতির খরচ যোগ
- রাইডার লগইন ও পিকআপ/রিপেয়ার/ডেলিভারি স্ট্যাটাস আপডেট
- বুকিং SQLite ডাটাবেসে সংরক্ষণ
- বুকিং-সংক্রান্ত WhatsApp click-to-chat লিংক
- মোবাইল-ফ্রেন্ডলি বাংলা UI

## চার্জের নিয়ম
- রিপেয়ারিং পিকআপ + ডেলিভারি: ২ কেজির মধ্যে এবং ১০ কিমির মধ্যে ₹100
- ১০ কিমির বেশি হলে: ১০ কিমির পর অতিরিক্ত প্রতি কিমি ₹10 (কোডে পূর্ণ কিমিতে round up করা হয়)
- মোবাইল সামগ্রী হোম ডেলিভারি: ₹40
- রিপেয়ারিং/পণ্যের মূল্য আলাদা
- ২ কেজির বেশি রিপেয়ারিং বুকিং বর্তমান কোডে অনলাইন বুকিং হিসেবে নেওয়া হয় না; আগে দোকান থেকে চার্জ নিশ্চিত করতে হবে

## চালানোর জন্য
1. কম্পিউটারে Node.js 20 বা তার পরের LTS সংস্করণ ইনস্টল করুন।
2. এই ফোল্ডারে টার্মিনাল খুলে চালান:
   ```bash
   npm install
   ```
3. `.env.example` কপি করে `.env` নামে ফাইল করুন। `SHOP_WHATSAPP`, `SHOP_ADDRESS`, `ADMIN_PHONE`, `ADMIN_PASSWORD` এবং `SESSION_SECRET` নিজের তথ্য দিয়ে পরিবর্তন করুন।
4. চালান:
   ```bash
   npm start
   ```
5. ব্রাউজারে `http://localhost:3000` খুলুন।

Node.js প্রোগ্রাম নিজে `.env` ফাইল লোড করে না; তাই deployment-এ পরিবেশ ভেরিয়েবল সেট করুন, অথবা `dotenv` প্যাকেজ যোগ করে `require('dotenv').config()` ব্যবহার করুন। সহজভাবে local development-এর জন্য OS/environment থেকে variables সেট করা যায়। চাইলে `.env` সাপোর্ট যোগ করতে `npm install dotenv` করে `server.js`-এর একেবারে শুরুতে `require('dotenv').config();` যোগ করুন।

## প্রথম অ্যাডমিন
পরিবেশ ভেরিয়েবল না দিলে local demo-তে ফোন `9999999999`, পাসওয়ার্ড `ChangeThisAdminPassword123!`। এটি শুধু local test-এর জন্য। public deployment-এর আগে অবশ্যই আলাদা শক্তিশালী পাসওয়ার্ড ও SESSION_SECRET দিন।

## গুরুত্বপূর্ণ: লাইভ করার আগে
- `SHOP_WHATSAPP`-এ দেশের কোডসহ WhatsApp নম্বর দিন, যেমন `91` + 10-digit নম্বর; `+`, ফাঁক বা ড্যাশ দেবেন না।
- `SHOP_ADDRESS`-এ দোকানের ঠিকানা দিন।
- production-এ HTTPS ব্যবহার করুন এবং session store-কে persistent/secure store দিয়ে বদলান; Express-এর default in-memory session store production-এর জন্য উপযুক্ত নয়।
- SQLite ফাইলটি persistent storage-এ রাখতে হবে; ephemeral hosting হলে ডেটা হারাতে পারে।
- ডাটাবেস ব্যাকআপ, rate limiting, লগইন প্রচেষ্টা সীমা, password reset, privacy policy, cancellation/refund policy এবং customer consent যুক্ত করুন।
- WhatsApp লিংক ব্যবহারকারীর WhatsApp-এ খোলে এবং ব্যবহারকারী Send চাপেন; এটি WhatsApp Business API-এর স্বয়ংক্রিয় বার্তা নয়।
- এই starter-এ অনলাইন পেমেন্ট, লাইভ GPS tracking, rider navigation, SMS OTP, স্বয়ংক্রিয় দূরত্ব নির্ণয় বা production-grade audit log নেই।
- customer ও rider-এর ব্যক্তিগত তথ্য নিরাপদে ব্যবহার করুন। public deployment-এর আগে security review করান।

## স্ট্যাটাস
`pending` → `confirmed` → `rider_assigned` → `picked_up` → `repairing` → `ready` → `out_for_delivery` → `delivered`

প্রয়োজন অনুযায়ী `cancelled` ব্যবহার করা যায়।


## দোকানের তথ্য (আপডেট করা)
- WhatsApp: `919635959728`
- ঠিকানা: `ফুনকাতলা বাজার, শিব মন্দিরের নিকট`

`.env.example` কপি করে `.env` বানালে এই মানগুলো থাকবে। আপনার হোস্টিংয়ের environment variables-এও `SHOP_WHATSAPP=919635959728` এবং `SHOP_ADDRESS=ফুনকাতলা বাজার, শিব মন্দিরের নিকট` সেট করুন।
