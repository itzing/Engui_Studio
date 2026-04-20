import MainLayout from "@/components/layout/MainLayout";
import MobilePwaRootRedirect from "@/components/mobile/MobilePwaRootRedirect";

export default function HomePage() {
  return (
    <>
      <MobilePwaRootRedirect />
      <MainLayout />
    </>
  );
}