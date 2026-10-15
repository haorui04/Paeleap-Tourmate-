import "./globals.css";

export const metadata = {
  title: "Paeleap Tourism Assistant",
  description: "Bilingual tourism assistant prototype with safety checks"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
