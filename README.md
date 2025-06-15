# 📦 Pluck

> **See it? Pluck it.**

**Pluck** is an intuitive and powerful mobile utility designed to effortlessly extract and download media (images, audio, videos) from any webpage. Simply paste a link, and Pluck intelligently finds all downloadable media, organizes it by type, and allows you to save it directly to your device with a single tap.

[▶️ Preview](preview.gif)

---

## ✨ Features

* **Universal Media Extraction**
  Paste any webpage URL and Pluck scans its HTML to find all embedded images, audio, and video files.

* **Direct Link Recognition**
  Already have a direct media link (e.g., `.../image.png`)? Pluck detects it instantly and gets it ready for download.

* **Intelligent Categorization**
  Media is sorted into "Image," "Audio," and "Video" tabs — each with a count for a quick overview.

* **Effortless Downloads**
  Download any media with a single tap on a prominent download icon.

* **Real-Time Progress Tracking**
  A visual progress bar shows current download status clearly.

* **Automated Album Organization**
  Downloads are saved into a `Pluck/` album (e.g., `Pluck/Image`) to keep your media gallery organized.

* **Sleek Dark UI**
  A modern, eye-friendly dark theme enhances readability and aesthetics.

---

## 🛠️ Tech Stack

Pluck is built on a modern and robust tech foundation:

* **Framework**: [React Native](https://reactnative.dev/) + [Expo](https://expo.dev/)
* **Core Libraries**:

  * `expo-file-system` – File downloads & progress tracking
  * `expo-media-library` – Media saving & album organization
  * `expo-vector-icons` – Scalable and crisp icons
* **Language**: JavaScript (fully typed with TypeScript)

---

## 🚀 Getting Started

### ✅ Prerequisites

Make sure the following are installed:

* [Node.js](https://nodejs.org/) (LTS version recommended)
* [Git](https://git-scm.com/)
* [Expo Go](https://expo.dev/go) (on your Android device)

### 📥 Installation & Setup

1. **Clone the repository:**

   ```bash
   git clone https://github.com/your-username/pluck-app.git
   cd pluck-app
   ```

2. **Install dependencies:**

   ```bash
   npm install
   # or
   yarn install
   ```

3. **Run the app:**

   ```bash
   npx expo start
   ```

   Then scan the QR code shown in your terminal using the **Expo Go** app.

---

## ⚙️ How It Works

### 1. 🔗 Input & Initial Check

* Users paste a URL and tap **Pluck**.
* If the URL is a **direct media link** (e.g., `.mp4`, `.jpg`), it's immediately prepared for download — skipping scraping.

### 2. 🧹 Webpage Scraping (Non-Direct Links)

* A `fetch` request retrieves the webpage’s HTML.
* The `extractMedia` function (`./lib/parser.ts`) scans for media tags (`<img>`, `<audio>`, `<video>`).
* Relative paths are resolved into absolute URLs.

### 3. 📂 Dynamic Display

* Media is categorized and shown in "Image," "Audio," and "Video" tabs.
* UI updates dynamically with smooth tab-switching.

### 4. ⬇️ Download & Save

* User taps the download icon.
* App requests media library permissions.
* Downloads are managed with `DownloadResumable` (from `expo-file-system`).
* Media is saved using `expo-media-library` into appropriate `Pluck/` albums.

---

## 📜 License

This project is open-source and available under the **MIT License**.
See the [LICENSE.md](LICENSE.md) file for full details.
