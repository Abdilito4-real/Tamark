import { HomePage } from "@/components/home-page";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Solar Energy Solutions and Training",
  description: "Explore Tamark Solar Energy's solar solutions and practical technical training in Kaduna, Nigeria.",
  path: "/",
});

export default function Page() {
  return <HomePage />;
}
