import { NextResponse, type NextRequest } from 'next/server'
import { supabaseServidor } from '@/lib/supabase/server'

// Pedido do titular (LGPD art. 18): o banco decide quem pode exportar.
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await supabaseServidor()
  const { data, error } = await supabase.rpc('exportar_dados', { p_pessoa: id })
  if (error) return NextResponse.json({ erro: error.message }, { status: 403 })
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': `attachment; filename="dados-${id}.json"`, 'Cache-Control': 'no-store' },
  })
}
