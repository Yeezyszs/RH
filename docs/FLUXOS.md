# 🔄 FLUXOS DE AÇÃO — Como as coisas acontecem no sistema

> **Objetivo:** Entender exatamente o que acontece do clique até o banco atualizar.

---

## 1️⃣ FLUXO: Criar novo colaborador

### Ação: Usuário clica em "➕ Novo Colaborador"

```
HTML (index.html)
    ↓
<button onclick="abrirModalColaborador()">➕ Novo</button>
    ↓
JavaScript (window.abrirModalColaborador chamado)
    ↓
src/modules/colaboradores.js :: ColaboradoresModule.abrirModalColaborador()
    ↓
Modal abre (CSS: .modal.active)
```

---

### Ação: Usuário preenche nome, email, setor e clica "Salvar"

```
HTML (index.html)
    ↓
<form onsubmit="salvarColaborador(event)">
    <input name="nome" value="João Silva">
    <input name="email" value="joao@empresa.com">
    <select name="setor" value="Produção">
</form>
    ↓
JavaScript: salvarColaborador(event) executada
(window.salvarColaborador vem de window.* exposta em src/app.js)
    ↓
src/modules/colaboradores.js :: salvarColaborador(event) {
  1. Ler dados do formulário
  2. Validar (nome != '', email != '')
  3. Chamar API
}
    ↓
AQUI ACONTECE A MÁGICA: Dados vão para o backend
```

---

### 🔑 PONTO CRÍTICO: Dados saindo do JavaScript para o banco

**Arquivo:** `src/api/pessoas.js`

```javascript
// Isso é o que salvarColaborador() chama:
await Colaboradores.criar(payload);

// Dentro de Colaboradores.criar():
const { data, error } = await sb
  .from('colaboradores')           // ← Nome da tabela no Supabase
  .insert([payload])               // ← INSERT (criar nova linha)
  .select()                        // ← Retornar dados criados
  .single();                       // ← Uma linha (não array)
```

**O que é `sb`?** Cliente Supabase definido em `supabase.js`

---

### Arquivo `supabase.js` — O Coração da Conexão

```javascript
// 1. Criar cliente Supabase (conecta ao banco remoto)
const sb = new SupabaseClient(SUPABASE_URL, SUPABASE_ANON);

// Exemplo do que acontece internamente:
// sb.from('colaboradores').insert([{nome: 'João', email: 'joao@...', ...}])
// ↓
// HTTP POST para https://smfiujgaxaodyfwvoxwy.supabase.co/rest/v1/colaboradores
// Body: {"name":"João","email":"joao@..."}
// ↓
// Supabase recebe
// ↓
// PostgreSQL executa: INSERT INTO colaboradores (nome, email, ...) VALUES (...)
// ↓
// Registro criado no banco ✅
// ↓
// Resposta volta para JavaScript com o novo ID e dados
```

**Fluxo de dados:**
```
JavaScript (seu código)
    ↓ (HTTP POST)
Supabase (servidor remoto)
    ↓
PostgreSQL (banco de dados)
    ↓ (resposta com novo ID)
JavaScript (seu código recebe dados)
```

---

### De volta ao módulo: Processar resposta

```javascript
// src/modules/colaboradores.js :: salvarColaborador()

try {
  const novo = await Colaboradores.criar(dados);
  // ↑ 'novo' = resposta do Supabase com {id: 1, nome: 'João', ...}

  // 4. Atualizar o array global (data-store.js)
  window.COLABORADORES.unshift(novo);
  // ↑ Adiciona ao topo do array

  // 5. Re-renderizar tabela
  window.renderColaboradores();
  // ↑ Lê window.COLABORADORES e gera novo HTML

  // 6. Feedback ao usuário
  showToast('João Silva adicionado!', 'ok');

  // 7. Fechar modal
  fecharModalColaborador();

} catch (erro) {
  showToast(`Erro: ${erro.message}`, 'err');
}
```

---

### Na tela: Tabela atualiza

```javascript
// src/modules/colaboradores.js :: render()

render() {
  const tb = document.getElementById('tb-colaboradores');
  
  // Lê o array global atualizado
  const html = this.COLABORADORES.map(c => `
    <tr onclick="abrirDrawerColab(${c.id})">
      <td>${this.h(c.nome)}</td>
      <td>${this.h(c.setor)}</td>
      <td>${this.fmtDate(c.data_admissao)}</td>
      <td>
        <button onclick="event.stopPropagation(); editarColaborador(${c.id})">✎</button>
        <button onclick="event.stopPropagation(); deletarColaborador(${c.id})">🗑</button>
      </td>
    </tr>
  `).join('');
  
  tb.innerHTML = html;  // ← Tabela renderizada com nova linha no topo
}
```

**Resultado na tela:**
```
┌────────────────────────────────────────┐
│ João Silva  │ Produção │ 08/06/2026 │ ✎ 🗑 │  ← NOVA (criada agora)
│ Ana Paula   │ Admin    │ 15/05/2026 │ ✎ 🗑 │
│ Carlos      │ Externa  │ 22/04/2026 │ ✎ 🗑 │
└────────────────────────────────────────┘
```

---

## 2️⃣ FLUXO: Editar um colaborador

### Ação: Clica em "✎ Editar"

```
HTML (index.html dentro da tabela renderizada)
    ↓
<button onclick="editarColaborador(${c.id})">✎</button>
    ↓ (c.id = 42)
JavaScript: editarColaborador(42)
    ↓
src/modules/colaboradores.js :: abrirModalEditar(42)
    ↓
Modal abre com dados do colaborador 42 preenchidos
```

---

### Ação: Usuário muda "Setor" para "Administrativo" e clica "Salvar"

```
Form executa: onsubmit="salvarColaborador(event)"
    ↓
salvarColaborador() detecta id=42 (modo edição)
    ↓
await Colaboradores.atualizar(42, {setor: 'Administrativo'})
    ↓ (chamado em src/api/pessoas.js)
```

---

### 🔑 PONTO CRÍTICO: Dados indo para o UPDATE

**Arquivo:** `src/api/pessoas.js`

```javascript
// Dentro de Colaboradores.atualizar():
const { data, error } = await sb
  .from('colaboradores')
  .update({setor: 'Administrativo'})  // ← Dados a atualizar
  .eq('id', 42)                       // ← Qual linha atualizar
  .select()
  .single();

// O que acontece no banco:
// UPDATE colaboradores SET setor='Administrativo' WHERE id=42;
```

---

### De volta ao módulo

```javascript
// src/modules/colaboradores.js :: salvarColaborador()

const novo = await Colaboradores.atualizar(42, {setor: 'Administrativo'});

// Atualizar o array global
const idx = this.COLABORADORES.findIndex(c => c.id === 42);
if (idx >= 0) {
  this.COLABORADORES[idx] = novo;  // ← Substituir objeto no array
}

// Re-renderizar
this.render();  // Tabela atualiza

// Feedback
showToast('Setor atualizado para Administrativo!', 'ok');
fecharModalColaborador();
```

---

## 3️⃣ FLUXO: Deletar um colaborador

### Ação: Clica em "🗑 Deletar"

```
<button onclick="deletarColaborador(${c.id})">🗑</button>
    ↓ (c.id = 42)
JavaScript: deletarColaborador(42)
    ↓
Confirmação: if (!confirm('Excluir?')) return;
    ↓ (usuário clica OK)
```

---

### 🔑 PONTO CRÍTICO: DELETE no Supabase

**Arquivo:** `src/api/pessoas.js`

```javascript
// Dentro de Colaboradores.excluir():
const { error } = await sb
  .from('colaboradores')
  .delete()                // ← Operação DELETE
  .eq('id', 42)           // ← Qual linha deletar
  
// O que acontece no banco:
// DELETE FROM colaboradores WHERE id=42;
```

---

### De volta ao módulo

```javascript
// src/modules/colaboradores.js :: deletarColaborador()

try {
  await Colaboradores.excluir(42);
  
  // Remove do array global
  this.COLABORADORES = this.COLABORADORES.filter(c => c.id !== 42);
  
  // Re-renderizar
  this.render();  // Linha desaparece da tabela
  
  // Feedback
  showToast('Colaborador removido', 'ok');
  
} catch (erro) {
  showToast(`Erro ao deletar: ${erro.message}`, 'err');
}
```

---

## 4️⃣ FLUXO: Sincronização em Tempo Real (Websocket)

### Cenário: Outro usuário cria um colaborador

```
Outro usuário (em outro computador)
    ↓
Clica "Novo Colaborador"
    ↓
Dados vão para Supabase/PostgreSQL
    ↓
INSERT realizado no banco
    ↓
Supabase websoket dispara evento: "postgres_changes"
```

---

### Seu app recebe a notificação em tempo real

**Arquivo:** `src/api/init.js`

```javascript
// Esta função é chamada quando o app inicia:
export const setupRealTimeListeners = () => {
  sb.from('colaboradores')
    .on('postgres_changes', {
      event: '*',              // Qualquer evento (INSERT, UPDATE, DELETE)
      schema: 'public',
      table: 'colaboradores'   // Tabela a monitorar
    }, (payload) => {
      // Este código executa QUANDO OUTRO USUÁRIO faz algo
      
      console.log('Mudança detectada:', payload.eventType);
      // payload.eventType = 'INSERT', 'UPDATE', ou 'DELETE'
      // payload.new = novo objeto (para INSERT/UPDATE)
      // payload.old = objeto anterior (para UPDATE/DELETE)
      
      if (payload.eventType === 'INSERT') {
        window.COLABORADORES.unshift(payload.new);
      } else if (payload.eventType === 'UPDATE') {
        const idx = window.COLABORADORES.findIndex(c => c.id === payload.new.id);
        if (idx >= 0) window.COLABORADORES[idx] = payload.new;
      } else if (payload.eventType === 'DELETE') {
        window.COLABORADORES = window.COLABORADORES.filter(c => c.id !== payload.old.id);
      }
      
      // Re-renderizar
      window.renderColaboradores?.();
    })
    .subscribe();  // ← Ativa o listener (abre conexão websocket)
};
```

---

### Resultado na sua tela

Sem fazer nada, sua tabela **atualiza automaticamente** mostrando o novo colaborador criado pelo outro usuário. ✨

---

## 5️⃣ FLUXO: Entender o Stack Completo

### Diagrama de um CREATE

```
┌─────────────────────────────────────────────────────────────────────┐
│ NAVEGADOR (seu código JavaScript)                                   │
│                                                                     │
│  src/modules/colaboradores.js                                      │
│  ↓                                                                  │
│  salvarColaborador() {                                             │
│    await Colaboradores.criar(dados)  ← Chama API layer             │
│  }                                                                  │
└─────────────────────────────────────────────────────────────────────┘
                            ↓ (HTTP POST)
┌─────────────────────────────────────────────────────────────────────┐
│ SUPABASE (servidor remoto)                                         │
│                                                                     │
│  src/api/pessoas.js                                                │
│  ↓                                                                  │
│  Colaboradores.criar(dados) {                                      │
│    sb.from('colaboradores').insert([dados]).select().single()     │
│  }                                                                  │
│                                                                     │
│  ↓                                                                  │
│  Supabase REST API recebe POST /rest/v1/colaboradores             │
└─────────────────────────────────────────────────────────────────────┘
                            ↓ (SQL)
┌─────────────────────────────────────────────────────────────────────┐
│ POSTGRESQL (banco de dados)                                        │
│                                                                     │
│  INSERT INTO colaboradores (nome, email, setor, ...)              │
│  VALUES ('João', 'joao@...', 'Produção', ...)                     │
│                                                                     │
│  ↓ NOVO ID GERADO = 42                                             │
│                                                                     │
│  Retorna: {id: 42, nome: 'João', email: '...', ...}               │
└─────────────────────────────────────────────────────────────────────┘
                            ↓ (resposta JSON)
┌─────────────────────────────────────────────────────────────────────┐
│ NAVEGADOR (seu código JavaScript)                                   │
│                                                                     │
│  const novo = await Colaboradores.criar(dados);                    │
│  ↓ novo = {id: 42, nome: 'João', ...}                              │
│                                                                     │
│  window.COLABORADORES.unshift(novo);  ← Atualiza array global     │
│  window.renderColaboradores();        ← Re-renderiza tabela       │
│  showToast('João adicionado!');       ← Feedback visual           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 6️⃣ ONDE PROCURAR CADA COISA

### "Como funciona autenticação?"
```
1. Leia: supabase.js → Auth object
2. Depois: src/auth.js → handleLogin()
3. Fluxo: user clica login → handleLogin() → Auth.login() → Supabase → sessão criada
```

### "Como carregar dados ao iniciar?"
```
1. Leia: src/api/init.js → inicializarSupabase()
2. Vê: Promise.allSettled([...]) carrega 15 tabelas em paralelo
3. Depois: window.COLABORADORES = data → global atualizado
4. Depois: window.renderAll() → tudo renderizado
```

### "Como um filtro funciona?"
```
1. Leia: src/modules/colaboradores.js → setupEventListeners()
2. Vê: addEventListener('change') → re-renderiza ao selecionar filtro
3. Depois: render() → filtra array COLABORADORES
4. Resultado: tabela mostra apenas itens filtrados
```

### "Como editar dados?"
```
1. Clique no botão "✎ Editar"
2. Modal abre com dados preenchidos
3. Mude algum campo
4. Clique "Salvar"
5. Código: salvarColaborador() → Colaboradores.atualizar() → UPDATE no banco
6. Resultado: global COLABORADORES atualizado → tabela re-renderizada
```

### "Como deletar dados?"
```
1. Clique no botão "🗑 Deletar"
2. Confirmação: "Tem certeza?"
3. Código: deletarColaborador() → Colaboradores.excluir() → DELETE no banco
4. Resultado: linha removida do array global → tabela re-renderizada
```

---

## 7️⃣ ORDEM RECOMENDADA PARA ESTUDAR

**Iniciante:**
1. `src/data-store.js` — O que são os arrays globais?
2. `supabase.js` — Como se conecta ao banco?
3. `src/api/pessoas.js` — Como fazer CRUD?
4. `src/modules/colaboradores.js` — Como renderizar?

**Intermediário:**
5. `src/auth.js` — Como autenticar?
6. `src/api/init.js` — Como carregar tudo ao iniciar?
7. `src/dashboard.js` — Como navegar entre abas?

**Avançado:**
8. `src/app.js` — Como tudo se conecta?
9. `tests/` — Como testar?
10. Supabase policies — Como proteger dados?

---

## ✨ Resumo

| O que? | Onde? | Como? |
|-------|-------|-------|
| **Clique em "Salvar"** | `index.html` (onclick) | → `src/modules/colaboradores.js` (salvarColaborador) |
| **Validação** | `src/modules/colaboradores.js` | if (!dados.nome) return; |
| **Ir para o banco** | `src/api/pessoas.js` | Colaboradores.criar(dados) |
| **HTTP POST** | `supabase.js` | sb.from('colaboradores').insert() |
| **Atualizar array** | `src/modules/colaboradores.js` | window.COLABORADORES.unshift(novo) |
| **Re-renderizar** | `src/modules/colaboradores.js` | this.render() |
| **Feedback** | `src/dashboard.js` | showToast('Salvo!') |

---

**Próximo passo:** Escolha um fluxo acima e trace-o no seu código real com DevTools aberto (F12).
