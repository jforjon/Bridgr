import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";

interface TodoRow {
  id: string;
  name: string;
}

export default async function TodosPage() {
  const cookieStore = cookies();
  const supabase = createClient(cookieStore);
  const { data: todos } = await supabase.from("todos").select();

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-bold text-primary">Todos</h1>
      <ul className="mt-4 space-y-2">
        {(todos as TodoRow[] | null)?.map((todo) => (
          <li key={todo.id} className="rounded border border-slate-200 p-3 text-sm">
            {todo.name}
          </li>
        ))}
      </ul>
    </main>
  );
}
