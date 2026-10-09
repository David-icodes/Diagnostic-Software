import { LisDocument } from "@/components/whatsapp/lis-document";

export default async function WhatsAppDocumentPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return <LisDocument reviewId={typeof query.reviewId === "string" ? query.reviewId : ""} />;
}
