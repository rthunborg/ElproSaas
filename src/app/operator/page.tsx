import { OperatorConsole } from "@/components/operator-console/OperatorConsole";
import { readOperatorConsole } from "@/server/read-models/operator-console";
import { resolvePlatformOperator } from "@/server/auth/resolve-platform-operator";

export const dynamic = "force-dynamic";

export default async function OperatorPage() {
  if (!(await resolvePlatformOperator()).ok) return <p>Åtkomst saknas.</p>;
  const result = await readOperatorConsole();
  if (!result.ok) return <p>Åtkomst saknas.</p>;
  return <OperatorConsole rows={result.data} />;
}
