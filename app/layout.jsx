import "./globals.css";

export const metadata = {
  title: "Tourmate · 小德兔 Museum Guide",
  description: "Explore Hangzhou’s Southern Song Deshou Palace Ruins Museum with Little De Rabbit: bilingual artifact explanations, archaeological remains and sourced cultural context.",
  applicationName: "Paeleap TourMate"
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#2563eb"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
