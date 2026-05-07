import { ProductView } from "@/components/ProductView";
import { loadGraphData } from "@/lib/graphLoader";
import { nodeById } from "@/lib/graphTraversal";
import { notFound } from "next/navigation";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const graph = loadGraphData();
  const product = nodeById(graph, id);
  if (!product) notFound();
  return (
    <div className="page">
      <ProductView graph={graph} product={product} />
    </div>
  );
}
