<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import {
  isAddress,
  isAddressEqual,
  zeroHash,
  type Address,
  type Hex,
} from 'viem';
import { useUser } from '@/composables/useUser';
import { useWalletModal } from '@/config/appkit';
import {
  getAllowListRoot,
  getP2PixAddress,
  setAllowListRoot,
} from '@/blockchain/sellerMethods';
import {
  allowListProof,
  allowListRoot,
  parseAllowListFile,
  readAllowList,
  writeAllowList,
  type AllowListEntry,
} from '@/utils/allowList';
import router from '@/router/index';
import CustomAlert from '@/components/ui/CustomAlert.vue';
import LoadingComponent from '@/components/ui/LoadingComponent.vue';
import ChevronDown from '@/assets/chevronDown.svg';
import LinkIcon from '@/assets/link.svg';
import PersonIcon from '@/assets/person.svg';
import TrashIcon from '@/assets/trash.svg';
import validIcon from '@/assets/validIcon.svg?url';
import invalidIcon from '@/assets/invalidIcon.svg?url';

const user = useUser();
const entries = ref<AllowListEntry[]>([]);
// Undefined while the network is read.
const chainRoot = ref<Hex>();
const step = ref<'edit' | 'confirm' | 'signing'>('edit');
const mode = ref<'save' | 'disable'>('save');
const panel = ref<'how' | 'verify' | null>(null);
const details = ref(false);
const alert = ref<'allowList' | 'allowListOff' | null>(null);
const justSaved = ref(false);
const startedNew = ref(false);
const addressInput = ref('');
const labelInput = ref('');
const addError = ref('');
const copied = ref<Address | 'command' | null>(null);
const mismatch = ref<{ root: Hex; name: string; count: number } | null>(null);
const fileInput = ref<HTMLInputElement>();

const short = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
const nameOf = (entry: AllowListEntry) => entry.label || short(entry.address);
const count = (n: number) => (n === 1 ? '1 endereço' : `${n} endereços`);
const names = (list: string[]) =>
  new Intl.ListFormat('pt-BR', { type: 'conjunction' }).format(list);

const seller = computed(() => user.walletAddress.value);
const network = computed(() => user.network.value);
const contract = computed(getP2PixAddress);
// The list after the next save, and the one on the network if it matches.
const next = computed(() =>
  entries.value.filter((entry) => entry.status !== 'removed'),
);
const saved = computed(() =>
  entries.value
    .filter((entry) => entry.status !== 'new')
    .map((entry) => entry.address),
);
const savedRoot = computed(() => allowListRoot(saved.value));
const newRoot = computed(() =>
  allowListRoot(next.value.map((entry) => entry.address)),
);
const active = computed(
  () => !!chainRoot.value && chainRoot.value !== zeroHash,
);
const matches = computed(
  () => active.value && savedRoot.value === chainRoot.value,
);
// The list is on the network but its addresses are not in this browser.
const needsFile = computed(
  () => active.value && !entries.value.length && !startedNew.value,
);
const joining = computed(() =>
  entries.value.filter((entry) => entry.status === 'new').map(nameOf),
);
const leaving = computed(() =>
  entries.value.filter((entry) => entry.status === 'removed').map(nameOf),
);
const changes = computed(() => joining.value.length + leaving.value.length);

const changesTitle = computed(() => {
  if (changes.value)
    return changes.value === 1
      ? '1 alteração a gravar'
      : `${changes.value} alterações a gravar`;
  return next.value.length
    ? `Reativar a lista com ${count(next.value.length)}`
    : 'Lista vazia';
});
const changesText = computed(() => {
  const who = [
    joining.value.length &&
      `${names(joining.value)} ${joining.value.length === 1 ? 'entra' : 'entram'}`,
    leaving.value.length &&
      `${names(leaving.value)} ${leaving.value.length === 1 ? 'sai' : 'saem'}`,
  ]
    .filter(Boolean)
    .join(', ');
  if (!next.value.length)
    return [who, 'raiz zero · gravar desativa a lista'].filter(Boolean);
  return [
    who,
    `nova raiz ${short(newRoot.value)}`,
    active.value
      ? 'os links já enviados deixam de valer'
      : 'depois, envie a cada comprador o link dele',
  ].filter(Boolean);
});
const copiedEntry = computed(() =>
  entries.value.find((entry) => entry.address === copied.value),
);
const castCommand = computed(
  () =>
    `cast call ${contract.value} "sellerAllowList(address)(bytes32)" ${seller.value} --rpc-url <SEU_RPC>`,
);
const confirmRoot = computed(() =>
  mode.value === 'disable' ? zeroHash : newRoot.value,
);
const confirmItems = computed(() =>
  mode.value === 'disable'
    ? [
        {
          sign: '−',
          text: !matches.value
            ? 'Quem está na lista volta ao limite de reputação'
            : saved.value.length === 1
              ? '1 comprador volta ao limite de reputação'
              : `${saved.value.length} compradores voltam ao limite de reputação`,
        },
      ]
    : next.value
        .filter((entry) => entry.status === 'new' || !active.value)
        .map((entry) => ({ sign: '+', text: `${nameOf(entry)} entra` }))
        .concat(
          active.value
            ? leaving.value.map((name) => ({ sign: '−', text: `${name} sai` }))
            : [],
        ),
);

watch(
  [seller, network],
  async ([address, chain], _, onCleanup) => {
    // Drop the read if the account or network changed meanwhile.
    let stale = false;
    onCleanup(() => (stale = true));
    chainRoot.value = undefined;
    entries.value = address ? readAllowList(chain.id, address) : [];
    startedNew.value = false;
    mismatch.value = null;
    if (!address) return;
    const root = await getAllowListRoot(address);
    if (!stale) chainRoot.value = root;
  },
  { immediate: true },
);

watch(
  entries,
  (value) =>
    seller.value && writeAllowList(network.value.id, seller.value, value),
  { deep: true },
);

const add = () => {
  const address = addressInput.value.trim().toLowerCase();
  if (!isAddress(address))
    return (addError.value =
      'Endereço inválido. Ele começa com 0x e tem 42 caracteres.');
  if (address === seller.value?.toLowerCase())
    return (addError.value =
      'Este é o endereço da sua carteira. Adicione o do comprador.');
  const found = entries.value.find((entry) =>
    isAddressEqual(entry.address, address),
  );
  if (found && found.status !== 'removed')
    return (addError.value = 'Este endereço já está na lista.');
  if (found) found.status = 'saved';
  else
    entries.value.push({
      address,
      label: labelInput.value.trim(),
      status: 'new',
    });
  addressInput.value = '';
  labelInput.value = '';
  addError.value = '';
  justSaved.value = false;
};

const remove = (entry: AllowListEntry) => {
  if (entry.status === 'new')
    entries.value.splice(entries.value.indexOf(entry), 1);
  else entry.status = 'removed';
  justSaved.value = false;
};

const confirm = (choice: 'save' | 'disable') => {
  mode.value = choice;
  details.value = false;
  panel.value = null;
  alert.value = null;
  step.value = 'confirm';
};

const sign = async () => {
  const root = confirmRoot.value;
  step.value = 'signing';
  try {
    await setAllowListRoot(root);
    chainRoot.value = root;
    // Disabling keeps the addresses here, unless every one was removed.
    if (mode.value === 'save' || !next.value.length)
      entries.value = next.value.map((entry) => ({
        ...entry,
        status: 'saved',
      }));
    alert.value = mode.value === 'save' ? 'allowList' : 'allowListOff';
    justSaved.value = mode.value === 'save';
    startedNew.value = false;
  } catch (cause) {
    console.error(cause);
    user.showToast('error', 'Não foi possível gravar a lista. Tente de novo.');
  }
  step.value = 'edit';
};

const copy = async (text: string, what: Address | 'command') => {
  await navigator.clipboard.writeText(text);
  copied.value = what;
  setTimeout(() => (copied.value = null), 1800);
};

// The buyer's link carries their proof against the root on the network.
const linkOf = (entry: AllowListEntry) =>
  new URL(
    router.resolve({
      name: 'home',
      query: {
        rede: network.value.id,
        vendedor: seller.value,
        comprador: entry.address,
        prova: allowListProof(saved.value, entry.address).join(','),
      },
    }).href,
    window.location.href,
  ).href;

const download = () => {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(
    new Blob(
      [
        JSON.stringify(
          {
            rede: network.value.id,
            vendedor: seller.value,
            compradores: entries.value
              .filter((entry) => entry.status !== 'new')
              .map((entry) => ({
                endereco: entry.address,
                apelido: entry.label,
              })),
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    ),
  );
  link.download = `lista-${network.value.name.split(' ')[0].toLowerCase()}-${seller.value?.slice(0, 6)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const importFile = async (file?: File) => {
  if (!file) return;
  const buyers = parseAllowListFile(await file.text());
  if (!buyers)
    return user.showToast(
      'error',
      'Este arquivo não é uma lista de compradores.',
    );
  const root = allowListRoot(buyers.map((buyer) => buyer.address));
  // Only the file of the list on the network can show its addresses here.
  if (active.value && root !== chainRoot.value)
    return (mismatch.value = { root, name: file.name, count: buyers.length });
  mismatch.value = null;
  entries.value = buyers.map((buyer) => ({
    ...buyer,
    status: active.value ? 'saved' : 'new',
  }));
};
</script>

<template>
  <div v-if="step === 'signing'">
    <LoadingComponent message="A transação está sendo enviada para a rede." />
  </div>
  <div v-else class="flex flex-col items-center px-3 pb-16">
    <CustomAlert v-if="alert" :type="alert" @close-alert="alert = null" />

    <section class="flex flex-col items-center gap-3 mt-16 text-center">
      <h1 class="sm:text-3xl text-2xl font-bold text-white">
        Compradores confiáveis
      </h1>
      <p class="max-w-120 font-medium text-white">
        Libere quem você conhece para comprar das suas ofertas acima do limite
        de reputação.
      </p>
      <div class="flex flex-wrap items-center justify-center gap-x-1 gap-y-2">
        <span v-if="active" class="allow-pill">
          <img
            :src="matches ? validIcon : invalidIcon"
            :alt="
              matches
                ? 'Confere com este navegador'
                : 'Não confere com este navegador'
            "
            class="w-4 h-4"
          />
          Raiz <span class="font-mono">{{ short(chainRoot ?? '') }}</span>
        </span>
        <button
          v-for="option in [
            { key: 'how', text: 'Como funciona' },
            { key: 'verify', text: 'Verificação' },
          ] as const"
          :key="option.key"
          type="button"
          class="allow-ghost text-gray-50"
          :aria-expanded="panel === option.key"
          @click="panel = panel === option.key ? null : option.key"
        >
          {{ option.text }}
          <ChevronDown
            class="transition-transform"
            :class="{ 'rotate-180': panel === option.key }"
          />
        </button>
        <button
          v-if="active"
          type="button"
          class="allow-ghost text-gray-50"
          @click="confirm('disable')"
        >
          Desativar lista
        </button>
      </div>
    </section>

    <div
      v-if="panel"
      class="w-full max-w-4xl mt-4 p-4 rounded-lg bg-white text-sm text-gray-900"
    >
      <ul v-if="panel === 'how'" class="flex flex-col gap-2 pl-5 list-disc">
        <li>
          Quem está na lista reserva das suas ofertas sem o limite de reputação.
          Os demais continuam comprando dentro do próprio limite: ninguém é
          bloqueado.
        </li>
        <li>
          A lista vale para todas as suas ofertas nesta rede. Em outra rede,
          grave outra lista.
        </li>
        <li>
          O contrato guarda só a raiz, um resumo de 32 bytes. Os endereços e
          apelidos ficam neste navegador e no arquivo que você baixa.
        </li>
        <li>
          Cada comprador recebe um link com a prova dele. O link só funciona na
          carteira dele e muda sempre que você grava uma lista nova.
        </li>
        <li>
          A lista não é secreta: ao usar o link, a transação do comprador mostra
          o endereço dele e pode mostrar outro endereço da lista.
        </li>
        <li>
          Você também pode chamar <code>setRoot()</code> direto no contrato, sem
          este app.
        </li>
      </ul>
      <template v-else>
        <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt class="text-gray-600">Rede</dt>
          <dd>{{ network.name }}</dd>
          <dt class="text-gray-600">P2Pix</dt>
          <dd class="font-mono">{{ short(contract) }}</dd>
          <dt class="text-gray-600">Leitura</dt>
          <dd class="font-mono">sellerAllowList({{ short(seller ?? '') }})</dd>
          <dt class="text-gray-600">Na rede</dt>
          <dd class="font-mono break-all">{{ chainRoot }}</dd>
          <dt class="text-gray-600">Calculada</dt>
          <dd class="font-mono break-all">{{ savedRoot }}</dd>
          <dt class="text-gray-600">Folha</dt>
          <dd>bytes32(uint160(endereço)), sem hash</dd>
          <dt class="text-gray-600">Árvore</dt>
          <dd>keccak256, pares ordenados</dd>
        </dl>
        <p class="mt-3 text-gray-600">
          {{
            !active
              ? 'A raiz na rede é zero: não há lista ativa. A raiz calculada é a da lista deste navegador.'
              : matches
                ? 'As duas raízes são iguais: a lista deste navegador é a que está na rede.'
                : 'As raízes são diferentes: a lista deste navegador não é a que está na rede.'
          }}
        </p>
        <button
          type="button"
          class="allow-ghost mt-2 text-gray-900"
          @click="copy(castCommand, 'command')"
        >
          {{ copied === 'command' ? 'Comando copiado' : 'Copiar comando' }}
        </button>
      </template>
    </div>

    <p v-if="!seller" class="mt-8 text-white">
      Conecte sua carteira para ver e gravar sua lista.
      <button
        type="button"
        class="allow-ghost text-amber-300"
        @click="useWalletModal().open({ view: 'Connect' })"
      >
        Conectar carteira
      </button>
    </p>

    <div
      v-else-if="chainRoot"
      class="flex flex-wrap items-start gap-6 w-full max-w-4xl mt-6"
    >
      <section
        v-if="!needsFile && step === 'edit'"
        aria-labelledby="allow-add"
        class="allow-card flex-[1_1_380px]"
      >
        <div class="flex items-center gap-3">
          <span class="allow-avatar w-10 h-10 text-2xl" aria-hidden="true">
            +
          </span>
          <h2 id="allow-add" class="font-semibold text-gray-900">
            Adicionar comprador
          </h2>
        </div>
        <form
          class="flex flex-col gap-2 pt-3 border-t border-gray-200"
          @submit.prevent="add"
        >
          <div class="flex flex-wrap items-end gap-3">
            <label class="allow-label flex-[3_1_280px]">
              Endereço da carteira
              <input
                v-model="addressInput"
                placeholder="0x…"
                spellcheck="false"
                autocomplete="off"
                :aria-invalid="!!addError"
                aria-describedby="allow-error allow-hint"
                class="allow-input font-mono text-sm"
                @input="addError = ''"
              />
            </label>
            <label class="allow-label flex-[2_1_160px]">
              Apelido (opcional)
              <input
                v-model="labelInput"
                placeholder="Ex.: Marina"
                autocomplete="off"
                class="allow-input"
              />
            </label>
            <button type="submit" class="allow-outline">+ Adicionar</button>
          </div>
          <p
            v-if="addError"
            id="allow-error"
            role="alert"
            class="text-sm text-red-600"
          >
            {{ addError }}
          </p>
          <p id="allow-hint" class="text-xs text-gray-500">
            Use o endereço que aparece no topo do app do comprador. O apelido
            não vai para a rede.
          </p>
        </form>
        <div
          v-if="newRoot !== chainRoot"
          role="region"
          aria-label="Alterações a gravar"
          class="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 -mx-4 -mb-4 p-4 border-t border-gray-200 rounded-b-lg bg-gray-50"
        >
          <div class="flex-[1_1_360px] min-w-0">
            <p class="font-semibold text-gray-900">{{ changesTitle }}</p>
            <p class="text-sm text-gray-600">{{ changesText.join(' · ') }}</p>
          </div>
          <button
            type="button"
            class="allow-primary flex-auto"
            @click="confirm(next.length ? 'save' : 'disable')"
          >
            Gravar lista na rede
          </button>
        </div>
      </section>

      <section
        v-if="step === 'confirm'"
        aria-labelledby="allow-confirm"
        class="allow-card flex-[1_1_380px]"
      >
        <div class="flex items-center gap-3">
          <span class="allow-avatar w-10 h-10" aria-hidden="true">✓</span>
          <div>
            <p class="text-xs font-medium text-gray-600">
              Confirme na carteira
            </p>
            <h2 id="allow-confirm" class="font-semibold text-gray-900">
              {{
                mode === 'disable'
                  ? 'Desativar a lista'
                  : active
                    ? 'Gravar a nova lista'
                    : 'Ativar a lista'
              }}
            </h2>
          </div>
        </div>
        <div class="flex flex-col gap-3 pt-3 border-t border-gray-200">
          <ul class="flex flex-col gap-1 text-sm text-gray-900">
            <li
              v-for="item in confirmItems"
              :key="item.text"
              class="flex items-start gap-2"
            >
              <span
                aria-hidden="true"
                class="allow-sign"
                :class="item.sign === '+' ? 'bg-amber-300' : 'bg-slate-400'"
              >
                {{ item.sign }}
              </span>
              {{ item.text }}
            </li>
            <li v-if="active" class="flex items-start gap-2">
              <span aria-hidden="true" class="allow-sign" />
              {{
                mode === 'disable'
                  ? 'Todos os links deixam de valer'
                  : 'Os links já enviados deixam de valer'
              }}
            </li>
            <li v-if="mode === 'disable'" class="flex items-start gap-2">
              <span aria-hidden="true" class="allow-sign" />
              Os endereços continuam neste navegador
            </li>
          </ul>
          <div class="rounded-lg bg-gray-100">
            <button
              type="button"
              class="allow-ghost justify-between w-full text-gray-900"
              :aria-expanded="details"
              @click="details = !details"
            >
              Detalhes da transação
              <ChevronDown
                class="transition-transform"
                :class="{ 'rotate-180': details }"
              />
            </button>
            <div v-if="details" class="px-3 pb-3 text-sm text-gray-900">
              <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <dt class="text-gray-600">Rede</dt>
                <dd>{{ network.name }}</dd>
                <dt class="text-gray-600">Contrato</dt>
                <dd>
                  P2Pix <span class="font-mono">{{ short(contract) }}</span>
                </dd>
                <dt class="text-gray-600">Função</dt>
                <dd class="font-mono">setRoot(address, bytes32)</dd>
                <dt class="text-gray-600">Endereço</dt>
                <dd>
                  <span class="font-mono">{{ short(seller ?? '') }}</span>
                  (você)
                </dd>
                <dt class="text-gray-600">Raiz</dt>
                <dd class="font-mono break-all">{{ confirmRoot }}</dd>
                <dt class="text-gray-600">Lista</dt>
                <dd>
                  {{
                    mode === 'disable' ? 'nenhum endereço' : count(next.length)
                  }}
                </dd>
              </dl>
              <p class="mt-2 text-gray-600">
                Na carteira, confira se o contrato, a função e a raiz são estes.
              </p>
            </div>
          </div>
          <p class="text-sm text-gray-600">
            Vale para todas as suas ofertas em {{ network.name }}.
            {{ active ? '' : 'Depois, envie a cada comprador o link dele.' }}
          </p>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            class="allow-ghost text-gray-900"
            @click="step = 'edit'"
          >
            Voltar
          </button>
          <button type="button" class="allow-primary" @click="sign">
            Assinar na carteira
          </button>
        </div>
      </section>

      <section
        aria-labelledby="allow-list"
        class="flex flex-col gap-2 flex-[999_1_480px] min-w-0"
      >
        <div class="flex flex-wrap items-center justify-between gap-x-4">
          <h2 id="allow-list" class="font-semibold text-white">
            Lista neste navegador
          </h2>
          <div v-if="!needsFile" class="flex flex-wrap gap-2">
            <button
              type="button"
              class="allow-small"
              @click="fileInput?.click()"
            >
              Importar arquivo
            </button>
            <button
              v-if="saved.length"
              type="button"
              class="allow-small"
              @click="download"
            >
              Baixar lista (.json)
            </button>
          </div>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept=".json,application/json"
          class="hidden"
          @change="
            importFile(($event.target as HTMLInputElement).files?.[0]);
            ($event.target as HTMLInputElement).value = '';
          "
        />
        <p role="status" class="sr-only">
          {{
            copiedEntry
              ? `Link de compra de ${nameOf(copiedEntry)} copiado.`
              : ''
          }}
        </p>

        <div v-if="needsFile || mismatch" class="allow-card gap-3">
          <template v-if="needsFile">
            <p class="text-sm text-gray-900">
              O contrato guarda só a raiz, não os endereços. Para ver ou editar
              a lista, traga o arquivo que você baixou quando gravou.
            </p>
            <button
              type="button"
              class="flex flex-col items-center justify-center gap-1.5 w-full min-h-37 p-6 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-center text-gray-900"
              @click="fileInput?.click()"
              @dragover.prevent
              @drop.prevent="importFile($event.dataTransfer?.files[0])"
            >
              <span class="font-semibold">
                Arraste o arquivo da lista para cá
              </span>
              <span class="text-sm text-gray-600">
                ou clique para escolher no computador · arquivo .json
              </span>
            </button>
          </template>
          <div v-if="mismatch" role="alert" class="flex flex-col gap-2.5">
            <div>
              <p class="text-sm font-semibold text-gray-900">
                O arquivo não é da lista atual
              </p>
              <p class="text-xs text-gray-600">
                Cada lista tem uma raiz, um resumo de 32 bytes. Para abrir os
                endereços aqui, a raiz do arquivo precisa ser igual à da rede.
              </p>
            </div>
            <div class="flex flex-wrap items-stretch gap-2">
              <div class="allow-root border-gray-200">
                <span class="text-xs text-gray-500">Raiz na rede</span>
                <span class="font-mono font-semibold text-gray-900">
                  {{ short(chainRoot) }}
                </span>
                <span class="text-xs text-gray-500">
                  Lista ativa · {{ network.name }}
                </span>
              </div>
              <span
                aria-hidden="true"
                class="self-center flex items-center justify-center w-8 h-8 rounded-full bg-red-50 font-bold text-red-700"
              >
                ≠
              </span>
              <div class="allow-root border-red-200 bg-red-50">
                <span class="text-xs text-gray-500">Raiz do arquivo</span>
                <span class="font-mono font-semibold text-red-700">
                  {{ short(mismatch.root) }}
                </span>
                <span class="text-xs text-gray-500 truncate">
                  {{ mismatch.name }} · {{ count(mismatch.count) }}
                </span>
              </div>
            </div>
          </div>
          <template v-if="needsFile">
            <p class="text-sm text-gray-600">
              Não tem o arquivo?
              <button
                type="button"
                class="allow-ghost text-gray-900 underline underline-offset-3"
                @click="
                  startedNew = true;
                  mismatch = null;
                "
              >
                Começar lista nova
              </button>
            </p>
            <p class="text-xs text-gray-500">
              Uma lista nova substitui a atual quando você gravar, e os links já
              enviados deixam de valer.
            </p>
          </template>
        </div>

        <div
          v-if="justSaved && matches"
          class="flex flex-col gap-1 mb-2 p-4 rounded-lg bg-white"
        >
          <p class="font-semibold text-gray-900">
            Envie o link novo a cada comprador
          </p>
          <p class="text-sm text-gray-600">
            Os links antigos deixaram de valer quando a raiz mudou. Use o ícone
            de link em cada cartão para copiar o link novo e mande por onde
            vocês já conversam.
          </p>
        </div>

        <div
          v-if="!needsFile && !entries.length"
          class="flex flex-col gap-2 p-6 border border-dashed border-gray-500 rounded-lg"
        >
          <p class="font-semibold text-white">Nenhum endereço ainda</p>
          <ol
            class="flex flex-col gap-1 pl-5 list-decimal text-sm text-gray-300"
          >
            <li>Adicione o endereço de quem você conhece.</li>
            <li>
              Grave a lista na rede. O contrato guarda só a raiz, não os
              endereços.
            </li>
            <li>
              Envie a cada comprador o link dele. Com o link, ele compra das
              suas ofertas sem o limite de reputação.
            </li>
          </ol>
        </div>

        <ul
          class="grid grid-cols-[repeat(auto-fill,minmax(min(200px,100%),1fr))] gap-3"
        >
          <li
            v-for="entry in entries"
            :key="entry.address"
            class="flex flex-col gap-2 min-w-0 pt-3 pr-2 pb-1 pl-3 rounded-lg"
            :class="[
              entry.status === 'removed' ? 'bg-gray-100' : 'bg-white',
              { 'outline-2 outline-amber-400': entry.status === 'new' },
            ]"
          >
            <div class="flex items-center gap-3 min-w-0">
              <span
                aria-hidden="true"
                class="allow-avatar w-8 h-8 text-sm"
                :class="{
                  'bg-slate-400! text-gray-900!': entry.status === 'removed',
                }"
              >
                <template v-if="entry.label">
                  {{ entry.label.trim().charAt(0).toUpperCase() }}
                </template>
                <PersonIcon v-else />
              </span>
              <div
                class="flex flex-col min-w-0"
                :class="{ 'line-through': entry.status === 'removed' }"
              >
                <span
                  class="text-sm truncate"
                  :class="
                    entry.label && entry.status !== 'removed'
                      ? 'font-semibold text-gray-900'
                      : 'text-gray-500'
                  "
                >
                  {{ entry.label || 'Sem apelido' }}
                </span>
                <span class="font-mono text-xs text-gray-600 truncate">
                  {{ short(entry.address) }}
                </span>
              </div>
            </div>
            <div
              class="flex items-center justify-between gap-2 pt-1 border-t border-gray-200"
            >
              <span
                v-if="entry.status === 'saved'"
                class="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600"
              >
                <span
                  aria-hidden="true"
                  class="w-2 h-2 rounded-full"
                  :class="matches ? 'bg-emerald-500' : 'bg-gray-400'"
                />
                {{ matches ? 'Na rede' : 'Só neste navegador' }}
              </span>
              <span
                v-else-if="entry.status === 'new'"
                class="flex items-center gap-2 min-w-0 text-xs"
              >
                <span class="allow-tag bg-amber-300">Novo</span>
                <span class="text-gray-500">link depois de gravar</span>
              </span>
              <span v-else class="allow-tag bg-slate-400">Sai da lista</span>
              <span class="flex gap-1">
                <button
                  v-if="entry.status === 'saved' && matches"
                  type="button"
                  class="allow-icon"
                  :aria-label="
                    copied === entry.address
                      ? `Link de compra de ${nameOf(entry)} copiado`
                      : `Copiar o link de compra de ${nameOf(entry)}`
                  "
                  @click="copy(linkOf(entry), entry.address)"
                >
                  <img
                    v-if="copied === entry.address"
                    :src="validIcon"
                    alt=""
                    class="w-4 h-4"
                  />
                  <LinkIcon v-else aria-hidden="true" />
                </button>
                <button
                  v-if="entry.status === 'removed'"
                  type="button"
                  class="allow-ghost text-gray-900"
                  :aria-label="`Manter ${nameOf(entry)} na lista`"
                  @click="entry.status = 'saved'"
                >
                  Desfazer
                </button>
                <button
                  v-else
                  type="button"
                  class="allow-icon"
                  :aria-label="`Remover ${nameOf(entry)} da lista`"
                  @click="remove(entry)"
                >
                  <TrashIcon aria-hidden="true" />
                </button>
              </span>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";
.allow-card {
  @apply flex flex-col gap-3 min-w-0 p-4 rounded-lg bg-white;
}
.allow-pill {
  @apply inline-flex items-center gap-2 mr-2 px-3 py-1.5 border border-gray-500 rounded-3xl text-sm font-medium text-gray-50;
}
.allow-ghost {
  @apply inline-flex items-center gap-1.5 min-h-11 px-3 rounded-lg text-sm font-semibold;
}
.allow-small {
  @apply min-h-8 px-2.5 border border-gray-500 rounded-lg text-xs font-medium text-gray-300;
}
.allow-primary {
  @apply min-h-13 px-6 py-3 border-2 border-amber-400 rounded-lg bg-amber-400 font-semibold text-gray-900;
}
.allow-outline {
  @apply h-11 px-4 border-2 border-amber-400 rounded-lg text-sm font-semibold text-gray-900;
}
.allow-label {
  @apply flex flex-col gap-1 min-w-0 text-xs font-medium text-gray-600;
}
.allow-input {
  @apply w-full h-11 px-3 border-2 border-gray-100 rounded-lg bg-gray-100 text-gray-900 outline-none aria-invalid:border-red-500;
}
.allow-avatar {
  @apply flex-none flex items-center justify-center rounded-full bg-indigo-900 font-semibold text-white;
}
.allow-sign {
  @apply flex-none flex items-center justify-center w-5 h-5 rounded-full font-semibold;
}
.allow-tag {
  @apply flex-none px-2 py-1 rounded-lg text-xs font-medium text-gray-900;
}
.allow-icon {
  @apply flex items-center justify-center w-11 h-11 rounded-lg text-gray-900;
}
.allow-root {
  @apply flex flex-col gap-0.5 flex-[1_1_200px] min-w-0 p-3 border rounded-lg;
}
</style>
