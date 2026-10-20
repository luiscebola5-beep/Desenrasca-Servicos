import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, RedirectToSignIn, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { ptPT } from '@clerk/localizations';
import { shadcn } from '@clerk/themes';
import { Link, Redirect, Route, Router as WouterRouter, Switch, useLocation, useRoute } from 'wouter';
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, ArrowUpRight, BadgeCheck, BriefcaseBusiness, CalendarDays,
  Check, ChevronDown, CircleHelp, CircleSlash, Clock3, Leaf, LogOut, Mail, MapPin, Menu, MessageCircle,
  Package, Pencil, Plus, Search, Send, ShieldCheck, Sparkles, Star, Trash2, UserRound, Wrench,
  RotateCcw, X,
} from 'lucide-react';
import {
  getGetJobQueryKey, getGetMeQueryKey, getGetStatsQueryKey, getHealthCheckQueryKey,
  getListApplicationMessagesQueryKey, getListJobApplicationsQueryKey, getListJobsQueryKey,
  getListMyApplicationsQueryKey, getListMyJobsQueryKey,
  useApplyToJob, useCreateJob, useDeleteJob, useGetJob, useGetMe, useGetStats,
  useHealthCheck, useListApplicationMessages, useListJobApplications, useListJobs,
  useListMyApplications, useListMyJobs, useSendApplicationMessage, useUpdateApplicationStatus,
  useUpdateJob, useUpdateMe,
} from '@workspace/api-client-react';
import type { Application, ApplicationStatusInputStatus, Job, JobCategory, JobInput, JobUpdate, Message } from '@workspace/api-client-react';

const queryClient = new QueryClient();
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}
if (!clerkPubKey) throw new Error('Falta a chave pública do Clerk nas variáveis de ambiente.');

const categories: { value: JobCategory; label: string; icon: typeof Leaf; detail: string }[] = [
  { value: 'limpezas', label: 'Limpezas', icon: Sparkles, detail: 'Casa em ordem, sem complicações.' },
  { value: 'jardinagem', label: 'Jardinagem', icon: Leaf, detail: 'Um jardim cuidado por quem sabe.' },
  { value: 'reparacoes', label: 'Reparações', icon: Wrench, detail: 'Pequenos arranjos, grandes alívios.' },
  { value: 'montagem_movel', label: 'Montagem de móveis', icon: Package, detail: 'Tudo no sítio, à primeira.' },
  { value: 'mudancas', label: 'Mudanças', icon: ArrowUpRight, detail: 'Uma ajuda para levar mais longe.' },
  { value: 'recados', label: 'Recados', icon: CircleHelp, detail: 'Tempo poupado no dia a dia.' },
  { value: 'outros', label: 'Outros serviços', icon: BriefcaseBusiness, detail: 'Diga-nos do que precisa.' },
];
const categoryName = (value: string) => categories.find((item) => item.value === value)?.label ?? value;
const euro = (value: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
const dateText = (value?: string | null) => value ? new Intl.DateTimeFormat('pt-PT', { dateStyle: 'medium' }).format(new Date(value)) : 'A combinar';
const fullDateText = (value: string) => new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#26794f', colorForeground: '#20364a', colorMutedForeground: '#637180',
    colorDanger: '#bd463b', colorBackground: '#fffefa', colorInput: '#fffefa',
    colorInputForeground: '#20364a', colorNeutral: '#d9dedb',
    fontFamily: 'DM Sans, sans-serif', borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffefa] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#20364a] font-bold tracking-tight',
    headerSubtitle: 'text-[#637180]',
    socialButtonsBlockButtonText: 'text-[#20364a] font-semibold',
    formFieldLabel: 'text-[#20364a] font-semibold',
    footerActionLink: 'text-[#26794f] font-bold',
    footerActionText: 'text-[#637180]',
    dividerText: 'text-[#637180]',
    identityPreviewEditButton: 'text-[#26794f]',
    formFieldSuccessText: 'text-[#26794f]',
    alertText: 'text-[#8e342d]',
    logoBox: 'mb-2',
    logoImage: 'h-10 w-auto',
    socialButtonsBlockButton: 'border-[#d9dedb] rounded-xl',
    formButtonPrimary: 'bg-[#26794f] hover:bg-[#1d6842] rounded-xl font-bold',
    formFieldInput: 'border-[#d9dedb] rounded-xl text-[#20364a]',
    footerAction: 'border-t border-[#e8e5dc]',
    dividerLine: 'bg-[#e8e5dc]',
    alert: 'rounded-xl',
    otpCodeFieldInput: 'rounded-lg border-[#d9dedb]',
    formFieldRow: 'gap-2',
    main: 'gap-5',
  },
};

function Brand({ small = false }: { small?: boolean }) {
  return <Link href="/" className={`brand ${small ? 'brand-small' : ''}`} data-testid="link-brand">
    <span className="brand-mark" aria-hidden="true"><ArrowDownLeft size={small ? 17 : 20} strokeWidth={3} /></span>
    <span>desenrasca<span className="brand-period">.</span></span>
  </Link>;
}

function Header() {
  const { isSignedIn, user } = useUser();
  const { signOut } = useClerk();
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  return <header className="site-header">
    <div className="page-wrap header-inner">
      <Brand />
      <nav className={`main-nav ${menuOpen ? 'nav-open' : ''}`} aria-label="Navegação principal">
        <Link href="/#encontrar" onClick={() => setMenuOpen(false)}>Encontrar serviços</Link>
        <Link href="/#como-funciona" onClick={() => setMenuOpen(false)}>Como funciona</Link>
        {isSignedIn && <Link href="/dashboard" onClick={() => setMenuOpen(false)}>A minha área</Link>}
      </nav>
      <div className="header-actions">
        {isSignedIn ? <>
          <span className="header-user" data-testid="text-username"><UserRound size={16} />{user?.firstName ?? 'A minha conta'}</span>
          <button className="icon-button logout-button" type="button" aria-label="Terminar sessão" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><LogOut size={17} /></button>
          <Link className="button button-primary header-post" href="/post"><Plus size={16} /> Publicar pedido</Link>
        </> : <>
          <Link className="header-login" href="/sign-in">Entrar</Link>
          <Link className="button button-primary header-post" href="/sign-up">Criar conta <ArrowRight size={16} /></Link>
        </>}
        <button className="icon-button menu-toggle" type="button" aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} onClick={() => setMenuOpen(!menuOpen)} data-testid="button-menu"><Menu size={20} /></button>
      </div>
    </div>
  </header>;
}

function Shell({ children }: { children: ReactNode }) {
  return <div className="app-shell noise"><Header />{children}<footer className="site-footer"><div className="page-wrap footer-inner"><Brand small /><p>Pequenos trabalhos. Boa vizinhança.</p><span>Estremoz, Alentejo</span></div></footer></div>;
}

function Notice({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' | 'info' }) {
  return <div className={`notice notice-${tone}`} role="status" data-testid={`status-${tone}`}><span>{children}</span></div>;
}
function ErrorState({ retry, message = 'Não foi possível carregar esta informação.' }: { retry: () => void; message?: string }) {
  return <div className="state-card"><span className="state-icon"><CircleHelp size={22} /></span><h3>Algo não correu como esperado</h3><p>{message}</p><button className="button button-outline" onClick={retry} type="button" data-testid="button-retry">Tentar novamente</button></div>;
}
function Skeleton({ count = 3 }: { count?: number }) {
  return <div className="job-list">{Array.from({ length: count }, (_, index) => <div className="skeleton-card" key={index}><span /><span /><span /></div>)}</div>;
}

function JobCard({ job }: { job: Job }) {
  return <Link href={`/jobs/${job.id}`} className="job-card lift" data-testid={`card-job-${job.id}`}>
    <div className="job-card-top"><span className="category-pill">{categoryName(job.category)}</span><span className="job-date"><Clock3 size={14} />{dateText(job.scheduledDate)}</span></div>
    <h3>{job.title}</h3>
    <p className="job-description">{job.description}</p>
    <div className="job-card-bottom"><span className="job-location"><MapPin size={15} />{job.location}</span><span className="job-budget">{euro(job.budget)}</span></div>
    <div className="job-card-meta"><span>{job.applicationCount} {job.applicationCount === 1 ? 'candidatura' : 'candidaturas'}</span><span className="job-owner">{job.ownerName || 'Pessoa da comunidade'}</span></div>
  </Link>;
}

function Home() {
  const [query, setQuery] = useState('');
  const [searchText, setSearchText] = useState('');
  const [location, setLocationFilter] = useState('');
  const [category, setCategory] = useState<JobCategory | ''>('');
  const params = {
    ...(searchText.trim() ? { q: searchText.trim() } : {}),
    ...(location.trim() ? { location: location.trim() } : {}),
    ...(category ? { category: category as JobCategory } : {}),
  };
  const jobs = useListJobs(params);
  const stats = useGetStats();
  useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), staleTime: 60_000 } });
  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setSearchText(query);
  }
  return <Shell>
    <main>
      <section className="hero">
        <div className="page-wrap hero-grid">
          <div className="hero-copy fade-up">
            <span className="eyebrow"><span className="eyebrow-dot" /> Agora em Estremoz</span>
            <h1>Há sempre alguém<br />por perto que <em>desenrasca.</em></h1>
            <p>Encontre ajuda para os pequenos trabalhos do dia a dia. Gente da sua zona, pronta a ajudar.</p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/post" data-testid="link-need-service">Preciso de um serviço <ArrowRight size={16} /></Link>
              <Link className="button button-hero-outline" href="/#pedidos-abertos" data-testid="link-work">Quero trabalhar <ArrowDownLeft size={16} /></Link>
            </div>
            <div className="hero-points"><span><ShieldCheck size={17} /> Pedidos claros</span><span><MapPin size={17} /> Perto de si</span></div>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="hero-orbit orbit-one"></div><div className="hero-orbit orbit-two"></div>
            <div className="hero-note note-main"><span className="note-mark"><Wrench size={20} /></span><span><strong>Um trabalho por resolver</strong><small>Encontre ajuda na sua zona.</small></span><ArrowRight size={19} /></div>
            <div className="hero-note note-side"><span className="note-leaf"><Leaf size={18} /></span><span><strong>Pessoas que ajudam</strong><small>Comunidade de Estremoz</small></span></div>
            <div className="hero-stamp">A boa<br />vizinhança<br /><b>começa aqui</b></div>
          </div>
        </div>
        <div className="page-wrap search-wrap" id="encontrar">
          <form className="search-panel" onSubmit={submitSearch}>
            <label className="search-field"><span>O que precisa?</span><span className="input-with-icon"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex.: arranjar uma porta" aria-label="Pesquisar serviços" data-testid="input-search" /></span></label>
            <span className="search-divider" aria-hidden="true"></span>
            <label className="search-field"><span>Onde?</span><span className="input-with-icon"><MapPin size={18} /><input value={location} onChange={(event) => setLocationFilter(event.target.value)} placeholder="Estremoz e arredores" aria-label="Localização" data-testid="input-location" /></span></label>
            <button className="button button-primary search-submit" type="submit" data-testid="button-search"><Search size={17} /><span>Pesquisar</span></button>
          </form>
        </div>
      </section>

      <section className="section categories-section">
        <div className="page-wrap">
          <div className="section-heading"><div><span className="eyebrow">O que precisa de fazer?</span><h2>Um pedido pequeno.<br className="desktop-break" /> Uma ajuda que faz diferença.</h2></div><button className="text-button" type="button" onClick={() => { setCategory(''); setSearchText(''); setQuery(''); }} data-testid="button-all-jobs">Ver todos os pedidos <ArrowRight size={16} /></button></div>
          <div className="category-grid">
            {categories.map((item) => {
              const Icon = item.icon;
              return <button key={item.value} type="button" className={`category-card ${category === item.value ? 'category-selected' : ''}`} onClick={() => { const next = category === item.value ? '' : item.value; setCategory(next); setSearchText(query); }} data-testid={`button-category-${item.value}`}>
                <span className="category-icon"><Icon size={20} /></span><strong>{item.label}</strong><small>{item.detail}</small>
              </button>;
            })}
          </div>
        </div>
      </section>

      <section className="section jobs-section" id="pedidos-abertos">
        <div className="page-wrap">
          <div className="section-heading jobs-heading"><div><span className="eyebrow">Pedidos perto de si</span><h2>{category ? categoryName(category) : searchText ? 'Resultados da pesquisa' : 'Precisa-se de uma mão'}</h2></div><span className="live-label"><span></span> Pedidos disponíveis</span></div>
          {jobs.isLoading ? <Skeleton /> : jobs.isError ? <ErrorState retry={() => void jobs.refetch()} /> : jobs.data?.length ? <div className="job-list">{jobs.data.map((job) => <JobCard key={job.id} job={job} />)}</div> : <div className="empty-jobs"><span className="empty-icon"><Search size={24} /></span><h3>Ainda não há pedidos por aqui</h3><p>Experimente ajustar a pesquisa ou volte mais tarde.</p><button className="button button-outline" onClick={() => { setCategory(''); setSearchText(''); setQuery(''); setLocationFilter(''); }} type="button" data-testid="button-clear-search">Limpar pesquisa</button></div>}
        </div>
      </section>

      <section className="how-section" id="como-funciona">
        <div className="page-wrap how-grid">
          <div className="how-intro"><span className="eyebrow eyebrow-light">Sem complicações</span><h2>A ajuda certa,<br />a poucos passos.</h2><p>Uma plataforma simples para aproximar quem precisa de ajuda de quem pode dar uma mão.</p><Link className="button button-light" href="/sign-up">Junte-se à comunidade <ArrowRight size={16} /></Link></div>
          <div className="how-steps">
            <div className="how-step"><span>01</span><div><h3>Explique o que precisa</h3><p>Publique o seu pedido com os detalhes e o valor que tem em mente.</p></div></div>
            <div className="how-step"><span>02</span><div><h3>Receba candidaturas</h3><p>Profissionais e pessoas da zona mostram interesse e falam consigo.</p></div></div>
            <div className="how-step"><span>03</span><div><h3>Resolva, em boa companhia</h3><p>Combine diretamente os detalhes e deixe o trabalho feito.</p></div></div>
          </div>
        </div>
      </section>
      <section className="local-section"><div className="page-wrap local-banner"><span className="local-icon"><MapPin size={21} /></span><div><h2>Começamos em Estremoz.</h2><p>Uma comunidade local cresce com cada pedido resolvido e cada pessoa que ajuda.</p></div><div className="local-stats">
        <div><strong>{stats.data?.openJobs ?? '—'}</strong><span>pedidos abertos</span></div><i></i><div><strong>{stats.data?.workers ?? '—'}</strong><span>pessoas na rede</span></div>
      </div></div></section>
    </main>
  </Shell>;
}

function Protected({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <Shell><div className="page-wrap protected-loading"><div className="skeleton-card"><span /><span /><span /></div></div></Shell>;
  if (!isSignedIn) return <RedirectToSignIn />;
  return <>{children}</>;
}

function ProfileBootstrap() {
  const { isLoaded, isSignedIn, user } = useUser();
  const me = useGetMe({ query: { enabled: !!(isLoaded && isSignedIn), queryKey: getGetMeQueryKey(), retry: false } });
  const updateMe = useUpdateMe();
  const initialized = useRef(false);
  useEffect(() => {
    if (isLoaded && !isSignedIn) initialized.current = false;
    if (isSignedIn && me.isSuccess && me.data && !me.data.displayName && user?.fullName && !initialized.current) {
      initialized.current = true;
      updateMe.mutate({ data: { displayName: user.fullName.slice(0, 60) } }, {
        onSuccess: (profile) => queryClient.setQueryData(getGetMeQueryKey(), profile),
      });
    }
  }, [isLoaded, isSignedIn, me.isSuccess, me.data, user?.fullName]);
  return null;
}

function PostJob() {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const create = useCreateJob();
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const input: JobInput = {
      title: String(form.get('title') ?? '').trim(),
      description: String(form.get('description') ?? '').trim(),
      category: String(form.get('category') ?? 'outros') as JobCategory,
      location: String(form.get('location') ?? '').trim(),
      budget: Number(form.get('budget')),
      scheduledDate: String(form.get('scheduledDate') ?? '') || null,
    };
    if (input.title.length < 4 || input.description.length < 10 || input.location.length < 2 || !Number.isFinite(input.budget) || input.budget < 0) {
      setError('Verifique os campos. O título precisa de 4 caracteres, a descrição de 10 e o valor não pode ser negativo.');
      return;
    }
    create.mutate({ data: input }, {
      onSuccess: (job) => {
        void client.invalidateQueries({ queryKey: getListJobsQueryKey() });
        void client.invalidateQueries({ queryKey: getListMyJobsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        setDone(true);
        window.setTimeout(() => setLocation(`/jobs/${job.id}`), 800);
      },
      onError: () => setError('Não foi possível publicar o pedido. Tente novamente.'),
    });
  }
  return <Protected><Shell><main className="page-wrap inner-page">
    <Link className="back-link" href="/"><ArrowLeft size={16} /> Voltar ao início</Link>
    <div className="form-layout"><div className="form-intro"><span className="eyebrow">Pedido de ajuda</span><h1>O que precisa<br />de resolver?</h1><p>Partilhe os detalhes. As pessoas da sua zona podem candidatar-se e falar consigo.</p><div className="trust-note"><ShieldCheck size={20} /><span><strong>Sem custos para publicar</strong><small>Fale apenas com quem se candidatar.</small></span></div></div>
      <form className="form-card" onSubmit={submit}>
        <h2>Descreva o trabalho</h2>{error && <Notice>{error}</Notice>}{done && <Notice tone="success">Pedido publicado. A abrir o seu anúncio…</Notice>}
        <label className="field"><span>Título do pedido</span><input name="title" minLength={4} maxLength={100} required placeholder="Ex.: Montar uma estante" data-testid="input-job-title" /></label>
        <label className="field"><span>Categoria</span><select name="category" defaultValue="outros" required data-testid="select-job-category">{categories.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label className="field"><span>Descrição</span><textarea name="description" minLength={10} maxLength={2000} required rows={5} placeholder="Conte o que é preciso fazer, com o máximo de detalhe possível." data-testid="input-job-description" /></label>
        <div className="form-row"><label className="field"><span>Localidade</span><input name="location" minLength={2} maxLength={100} required defaultValue="Estremoz" data-testid="input-job-location" /></label><label className="field"><span>Valor máximo (€)</span><input name="budget" type="number" min="0" max="100000" step="1" required placeholder="Ex.: 45" data-testid="input-job-budget" /></label></div>
        <label className="field"><span>Quando precisa? <small>Opcional</small></span><input name="scheduledDate" type="date" data-testid="input-job-date" /></label>
        <button className="button button-primary button-wide" type="submit" disabled={create.isPending} data-testid="button-create-job">{create.isPending ? 'A publicar…' : 'Publicar pedido'}<ArrowRight size={17} /></button>
      </form>
    </div>
  </main></Shell></Protected>;
}

function JobDetail() {
  const [, params] = useRoute('/jobs/:jobId');
  const jobId = Number(params?.jobId);
  const idIsValid = Number.isInteger(jobId) && jobId > 0;
  const job = useGetJob(idIsValid ? jobId : 0, { query: { enabled: idIsValid, queryKey: getGetJobQueryKey(idIsValid ? jobId : 0), retry: false } });
  const { isSignedIn } = useUser();
  const [showApply, setShowApply] = useState(false);
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const client = useQueryClient();
  const apply = useApplyToJob();
  if (!idIsValid) return <Shell><main className="page-wrap inner-page"><ErrorState retry={() => window.location.assign('/')} message="Este pedido não existe ou o endereço não é válido." /></main></Shell>;
  if (job.isLoading) return <Shell><main className="page-wrap inner-page"><Skeleton count={1} /></main></Shell>;
  if (job.isError || !job.data) return <Shell><main className="page-wrap inner-page"><ErrorState retry={() => void job.refetch()} message="Não encontrámos este pedido." /></main></Shell>;
  const item = job.data;
  function submitApply(event: FormEvent) {
    event.preventDefault();
    if (message.trim().length < 10) { setError('A mensagem deve ter pelo menos 10 caracteres.'); return; }
    apply.mutate({ jobId, data: { message: message.trim() } }, {
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: getListJobApplicationsQueryKey(jobId) });
        void client.invalidateQueries({ queryKey: getListMyApplicationsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetJobQueryKey(jobId) });
        setNotice('A sua candidatura foi enviada. Pode acompanhar a conversa na sua área.');
        setMessage(''); setShowApply(false);
      },
      onError: () => setError('Não foi possível enviar a candidatura. Tente novamente.'),
    });
  }
  return <Shell><main className="page-wrap inner-page">
    <Link className="back-link" href="/"><ArrowLeft size={16} /> Voltar aos pedidos</Link>
    <div className="detail-grid"><article className="detail-main">
      {notice && <Notice tone="success">{notice}</Notice>}
      <div className="detail-heading"><span className="category-pill">{categoryName(item.category)}</span><span className={`status-pill ${item.status === 'open' ? 'status-open' : 'status-closed'}`}>{item.status === 'open' ? 'Aberto' : 'Fechado'}</span></div>
      <h1>{item.title}</h1><div className="detail-meta"><span><MapPin size={17} />{item.location}</span><span><CalendarDays size={17} />{dateText(item.scheduledDate)}</span><span><Clock3 size={17} />Publicado {dateText(item.createdAt)}</span></div>
      <section className="detail-description"><h2>Sobre este pedido</h2><p>{item.description}</p></section>
      <div className="detail-owner"><span className="owner-avatar">{item.ownerName?.trim().charAt(0).toLocaleUpperCase('pt-PT') || <UserRound size={19} />}</span><span><strong>{item.ownerName || 'Pessoa da comunidade'}</strong><small>Na comunidade Desenrasca</small></span><BadgeCheck className="verified-mark" size={19} /></div>
    </article><aside className="apply-card"><span className="eyebrow">Orçamento indicado</span><strong className="detail-budget">{euro(item.budget)}</strong><p>Valor máximo previsto para este trabalho.</p><div className="apply-separator"></div><span className="detail-app-count"><UserRound size={17} />{item.applicationCount} {item.applicationCount === 1 ? 'pessoa interessada' : 'pessoas interessadas'}</span>
      {item.status === 'open' ? isSignedIn ? <button className="button button-primary button-wide" onClick={() => { setShowApply(!showApply); setError(''); }} type="button" data-testid="button-apply">{showApply ? 'Fechar candidatura' : 'Quero candidatar-me'}<ArrowRight size={16} /></button> : <Link className="button button-primary button-wide" href="/sign-in">Entre para se candidatar <ArrowRight size={16} /></Link> : <button className="button button-disabled button-wide" disabled>Pedido fechado</button>}
      {showApply && <form className="apply-form" onSubmit={submitApply}><label className="field"><span>Apresente-se</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={10} maxLength={1000} required rows={4} placeholder="Conte porque é a pessoa certa para este trabalho." data-testid="input-application-message" /></label>{error && <Notice>{error}</Notice>}<button className="button button-secondary button-wide" type="submit" disabled={apply.isPending} data-testid="button-submit-application">{apply.isPending ? 'A enviar…' : 'Enviar candidatura'}<Send size={16} /></button></form>}
      <p className="privacy-note"><ShieldCheck size={15} /> A conversa é privada entre as pessoas envolvidas.</p>
    </aside></div>
  </main></Shell>;
}

function ApplicationRow({ application, inbound = false, onStatus }: { application: Application; inbound?: boolean; onStatus?: (id: number, status: ApplicationStatusInputStatus) => void }) {
  return <article className="application-row" data-testid={`card-application-${application.id}`}>
    <div className="application-avatar"><UserRound size={18} /></div><div className="application-body"><div className="application-title-row"><strong>{inbound ? application.applicantName || 'Pessoa candidata' : application.jobTitle}</strong><span className={`status-pill status-${application.status}`}>{application.status === 'pending' ? 'Pendente' : application.status === 'accepted' ? 'Aceite' : 'Recusada'}</span></div><p>{application.message}</p><small>{fullDateText(application.createdAt)}</small>
      <div className="application-actions">
        {inbound && application.status === 'pending' && <><button className="button button-small button-secondary" onClick={() => onStatus?.(application.id, 'accepted')} type="button" data-testid={`button-accept-${application.id}`}><Check size={15} /> Aceitar</button><button className="button button-small button-outline" onClick={() => onStatus?.(application.id, 'rejected')} type="button" data-testid={`button-reject-${application.id}`}>Recusar</button></>}
        <Link className="text-button" href={`/applications/${application.id}/messages`} data-testid={`link-message-${application.id}`}><MessageCircle size={16} /> Abrir conversa</Link>
      </div>
    </div>
  </article>;
}

function ReceivedApplications({ job }: { job: Job }) {
  const applications = useListJobApplications(job.id, { query: { queryKey: getListJobApplicationsQueryKey(job.id), enabled: true } });
  const client = useQueryClient();
  const status = useUpdateApplicationStatus();
  if (applications.isLoading) return <div className="muted-loading">A carregar candidaturas…</div>;
  if (applications.isError) return <ErrorState retry={() => void applications.refetch()} />;
  if (!applications.data?.length) return <p className="tab-empty">Ainda não recebeu candidaturas para este pedido.</p>;
  return <div className="application-list">{applications.data.map((application) => <ApplicationRow key={application.id} application={application} inbound onStatus={(applicationId, nextStatus) => status.mutate({ applicationId, data: { status: nextStatus } }, {
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: getListJobApplicationsQueryKey(job.id) });
      void client.invalidateQueries({ queryKey: getListMyApplicationsQueryKey() });
    },
  })} />)}</div>;
}

function Dashboard() {
  const jobs = useListMyJobs({ query: { queryKey: getListMyJobsQueryKey(), retry: false } });
  const submitted = useListMyApplications({ query: { queryKey: getListMyApplicationsQueryKey(), retry: false } });
  const profile = useGetMe({ query: { queryKey: getGetMeQueryKey(), retry: false } });
  const updateMe = useUpdateMe();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const client = useQueryClient();
  const [activeTab, setActiveTab] = useState<'jobs' | 'received' | 'sent' | 'profile'>('jobs');
  const [expandedJob, setExpandedJob] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [profileError, setProfileError] = useState('');
  const [actionError, setActionError] = useState('');
  const [editingJobId, setEditingJobId] = useState<number | null>(null);
  const [editError, setEditError] = useState('');
  const [editSuccessJobId, setEditSuccessJobId] = useState<number | null>(null);
  useEffect(() => { if (profile.data?.displayName) setName(profile.data.displayName); }, [profile.data?.displayName]);
  function saveProfile(event: FormEvent) {
    event.preventDefault();
    setProfileNotice(''); setProfileError('');
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 60) { setProfileError('O nome deve ter entre 2 e 60 caracteres.'); return; }
    updateMe.mutate({ data: { displayName: trimmed } }, {
      onSuccess: (data) => { client.setQueryData(getGetMeQueryKey(), data); setProfileNotice('Nome atualizado.'); },
      onError: () => setProfileError('Não foi possível atualizar o seu nome.'),
    });
  }
  function removeJob(job: Job) {
    if (!window.confirm(`Tem a certeza de que pretende eliminar o pedido “${job.title}”?`)) return;
    deleteJob.mutate({ jobId: job.id }, {
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: getListMyJobsQueryKey() });
        void client.invalidateQueries({ queryKey: getListJobsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetStatsQueryKey() });
      },
      onError: () => setActionError('Não foi possível eliminar o pedido. Tente novamente.'),
    });
  }
  function openEditForm(job: Job) {
    setEditError('');
    setEditSuccessJobId(null);
    setEditingJobId(job.id);
  }
  function saveJob(job: Job, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEditError('');
    setEditSuccessJobId(null);
    const formData = new FormData(event.currentTarget);
    const title = String(formData.get('title') ?? '').trim();
    const description = String(formData.get('description') ?? '').trim();
    const location = String(formData.get('location') ?? '').trim();
    const budgetText = String(formData.get('budget') ?? '').trim();
    const budget = Number(budgetText);
    if (title.length < 4 || title.length > 100) {
      setEditError('O título deve ter entre 4 e 100 caracteres.');
      return;
    }
    if (description.length < 10 || description.length > 2000) {
      setEditError('A descrição deve ter entre 10 e 2000 caracteres.');
      return;
    }
    if (location.length < 2 || location.length > 100) {
      setEditError('A localidade deve ter entre 2 e 100 caracteres.');
      return;
    }
    if (!budgetText || !Number.isFinite(budget) || budget < 0 || budget > 100000) {
      setEditError('Indique um valor entre 0 € e 100 000 €.');
      return;
    }
    const update: JobUpdate = {
      title,
      description,
      category: String(formData.get('category') ?? job.category) as JobCategory,
      location,
      budget,
      scheduledDate: String(formData.get('scheduledDate') ?? '') || null,
    };
    updateJob.mutate({ jobId: job.id, data: update }, {
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: getListMyJobsQueryKey() });
        void client.invalidateQueries({ queryKey: getListJobsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetStatsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetJobQueryKey(job.id) });
        setEditingJobId(null);
        setEditSuccessJobId(job.id);
      },
      onError: () => setEditError('Não foi possível guardar as alterações. Verifique se ainda tem autorização para editar este pedido e tente novamente.'),
    });
  }
  return <Protected><Shell><main className="page-wrap inner-page dashboard-page">
    <div className="dashboard-welcome"><div><span className="eyebrow">A sua área</span><h1>Olá, {profile.data?.displayName || 'vizinho'}.</h1><p>Gerir pedidos, candidaturas e conversas num só lugar.</p></div><Link className="button button-primary" href="/post"><Plus size={16} /> Novo pedido</Link></div>
    <div className="dashboard-tabs" role="tablist" aria-label="Gestão da conta">
      {[['jobs', 'Os meus pedidos'], ['received', 'Candidaturas recebidas'], ['sent', 'As minhas candidaturas'], ['profile', 'O meu perfil']].map(([key, label]) => <button key={key} type="button" className={activeTab === key ? 'tab-active' : ''} onClick={() => setActiveTab(key as typeof activeTab)} role="tab" aria-selected={activeTab === key} data-testid={`tab-${key}`}>{label}</button>)}
    </div>
    {activeTab === 'jobs' && <section className="dashboard-content">
      {actionError && <Notice>{actionError}</Notice>}
      {jobs.isLoading ? <Skeleton /> : jobs.isError ? <ErrorState retry={() => void jobs.refetch()} /> : jobs.data?.length ? <div className="own-job-list">{jobs.data.map((job) => <article className="own-job-card" key={job.id} data-testid={`card-own-job-${job.id}`}>
        <div className="own-job-main"><span className="category-pill">{categoryName(job.category)}</span><h3>{job.title}</h3><div className="own-job-info"><span><MapPin size={14} />{job.location}</span><span>{euro(job.budget)}</span><span className={`status-pill status-${job.status}`}>{job.status === 'open' ? 'Aberto' : 'Fechado'}</span></div></div>
        <div className="own-job-actions">
          <button className="button button-small button-outline" onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)} type="button" data-testid={`button-applicants-${job.id}`}><UserRound size={15} /> {job.applicationCount} candidaturas <ChevronDown size={15} /></button>
          <button className="icon-button" title="Editar pedido" aria-label={`Editar pedido: ${job.title}`} onClick={() => openEditForm(job)} type="button" data-testid={`button-edit-job-${job.id}`}><Pencil size={16} /></button>
          <button className="button button-small button-outline" title={job.status === 'open' ? 'Fechar pedido' : 'Reabrir pedido'} onClick={() => { setActionError(''); updateJob.mutate({ jobId: job.id, data: { status: job.status === 'open' ? 'closed' : 'open' } }, { onSuccess: () => { void client.invalidateQueries({ queryKey: getListMyJobsQueryKey() }); void client.invalidateQueries({ queryKey: getListJobsQueryKey() }); void client.invalidateQueries({ queryKey: getGetJobQueryKey(job.id) }); }, onError: () => setActionError('Não foi possível atualizar o estado do pedido.') }); }} type="button" data-testid={`button-toggle-job-${job.id}`}>{job.status === 'open' ? <><CircleSlash size={15} /> Fechar</> : <><RotateCcw size={15} /> Reabrir</>}</button>
          <button className="icon-button danger-icon" title="Eliminar pedido" aria-label={`Eliminar pedido: ${job.title}`} onClick={() => removeJob(job)} type="button" data-testid={`button-delete-job-${job.id}`}><Trash2 size={16} /></button>
        </div>
        {editSuccessJobId === job.id && <div className="job-edit-success"><Notice tone="success">As alterações ao pedido foram guardadas.</Notice></div>}
        {editingJobId === job.id && <form className="job-edit-form" onSubmit={(event) => saveJob(job, event)} data-testid={`form-edit-job-${job.id}`}>
          <div className="job-edit-heading"><div><span className="eyebrow">Editar pedido</span><h4>Atualize os detalhes do trabalho</h4></div><button className="icon-button" type="button" aria-label="Fechar edição" onClick={() => { setEditingJobId(null); setEditError(''); }} data-testid={`button-close-edit-${job.id}`}><X size={17} /></button></div>
          {editError && <Notice>{editError}</Notice>}
          <label className="field"><span>Título do pedido</span><input name="title" defaultValue={job.title} required minLength={4} maxLength={100} data-testid={`input-edit-title-${job.id}`} /></label>
          <label className="field"><span>Categoria</span><select name="category" defaultValue={job.category} required data-testid={`select-edit-category-${job.id}`}>{categories.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
          <label className="field"><span>Descrição</span><textarea name="description" defaultValue={job.description} required minLength={10} maxLength={2000} rows={4} data-testid={`input-edit-description-${job.id}`} /></label>
          <div className="form-row"><label className="field"><span>Localidade</span><input name="location" defaultValue={job.location} required minLength={2} maxLength={100} data-testid={`input-edit-location-${job.id}`} /></label><label className="field"><span>Valor máximo (€)</span><input name="budget" type="number" defaultValue={job.budget} required min="0" max="100000" step="1" data-testid={`input-edit-budget-${job.id}`} /></label></div>
          <label className="field"><span>Quando precisa? <small>Opcional</small></span><input name="scheduledDate" type="date" defaultValue={job.scheduledDate?.slice(0, 10) ?? ''} data-testid={`input-edit-date-${job.id}`} /></label>
          <div className="job-edit-actions"><button className="button button-outline" type="button" onClick={() => { setEditingJobId(null); setEditError(''); }}>Cancelar</button><button className="button button-primary" type="submit" disabled={updateJob.isPending} data-testid={`button-save-edit-${job.id}`}>{updateJob.isPending ? 'A guardar…' : 'Guardar alterações'}<Check size={16} /></button></div>
        </form>}
        {expandedJob === job.id && <div className="received-panel"><h4>Candidaturas recebidas</h4><ReceivedApplications job={job} /></div>}
      </article>)}</div> : <div className="empty-jobs"><span className="empty-icon"><BriefcaseBusiness size={24} /></span><h3>Ainda não publicou pedidos</h3><p>Quando precisar de uma mão, pode começar por aqui.</p><Link className="button button-primary" href="/post"><Plus size={16} /> Publicar primeiro pedido</Link></div>}
    </section>}
    {activeTab === 'received' && <section className="dashboard-content"><h2>Candidaturas recebidas</h2>{jobs.isLoading ? <Skeleton /> : jobs.isError ? <ErrorState retry={() => void jobs.refetch()} /> : jobs.data?.length ? <div className="own-job-list">{jobs.data.map((job) => <div className="received-job-block" key={job.id}><div className="received-job-heading"><div><span className="category-pill">{categoryName(job.category)}</span><h3>{job.title}</h3></div><span className="job-budget">{euro(job.budget)}</span></div><ReceivedApplications job={job} /></div>)}</div> : <p className="tab-empty">Ainda não tem pedidos publicados.</p>}</section>}
    {activeTab === 'sent' && <section className="dashboard-content"><h2>As minhas candidaturas</h2>{submitted.isLoading ? <Skeleton /> : submitted.isError ? <ErrorState retry={() => void submitted.refetch()} /> : submitted.data?.length ? <div className="application-list">{submitted.data.map((application) => <ApplicationRow key={application.id} application={application} />)}</div> : <div className="empty-jobs"><span className="empty-icon"><Send size={22} /></span><h3>Ainda não se candidatou a nenhum pedido</h3><p>Encontre um trabalho que combine consigo e apresente-se.</p><Link className="button button-primary" href="/">Explorar pedidos <ArrowRight size={16} /></Link></div>}</section>}
    {activeTab === 'profile' && <section className="dashboard-content profile-card"><div><span className="eyebrow">Perfil público</span><h2>Como o veem na comunidade</h2><p>O seu nome aparece nos pedidos e candidaturas. Os seus contactos pessoais não são publicados.</p></div>{profileError && <Notice>{profileError}</Notice>}{profileNotice && <Notice tone="success">{profileNotice}</Notice>}<form className="profile-form" onSubmit={saveProfile}><label className="field"><span>Nome apresentado</span><input value={name} onChange={(event) => setName(event.target.value)} maxLength={60} minLength={2} required placeholder="O seu nome" data-testid="input-profile-name" /></label><div className="profile-rating"><Star size={17} /><strong>{profile.data?.ratingAverage ?? '—'}</strong><span>{profile.data?.ratingCount ?? 0} avaliações</span></div><button className="button button-primary" type="submit" disabled={updateMe.isPending} data-testid="button-save-profile">{updateMe.isPending ? 'A guardar…' : 'Guardar alterações'}<Check size={16} /></button></form></section>}
  </main></Shell></Protected>;
}

function Messages() {
  const [, params] = useRoute('/applications/:applicationId/messages');
  const applicationId = Number(params?.applicationId);
  const isValid = Number.isInteger(applicationId) && applicationId > 0;
  const messages = useListApplicationMessages(isValid ? applicationId : 0, { query: { enabled: isValid, queryKey: getListApplicationMessagesQueryKey(isValid ? applicationId : 0), retry: false } });
  const send = useSendApplicationMessage();
  const { user } = useUser();
  const client = useQueryClient();
  const [content, setContent] = useState('');
  const [error, setError] = useState('');
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!content.trim()) { setError('Escreva uma mensagem antes de enviar.'); return; }
    send.mutate({ applicationId, data: { content: content.trim() } }, {
      onSuccess: () => { setContent(''); setError(''); void client.invalidateQueries({ queryKey: getListApplicationMessagesQueryKey(applicationId) }); },
      onError: () => setError('Não foi possível enviar a mensagem. Tente novamente.'),
    });
  }
  return <Protected><Shell><main className="page-wrap inner-page">
    <Link className="back-link" href="/dashboard"><ArrowLeft size={16} /> Voltar à minha área</Link>
    {!isValid ? <ErrorState retry={() => window.location.assign('/dashboard')} message="Esta conversa não existe." /> : <section className="conversation-card">
      <div className="conversation-header"><span className="conversation-avatar"><MessageCircle size={19} /></span><div><h1>Conversa privada</h1><p>Sobre a candidatura #{applicationId}</p></div><span className="private-label"><ShieldCheck size={15} /> Privada</span></div>
      <div className="conversation-body">
        {messages.isLoading ? <div className="message-skeleton"><i /><i /><i /></div> : messages.isError ? <ErrorState retry={() => void messages.refetch()} message="Não foi possível carregar esta conversa." /> : messages.data?.length ? <div className="message-thread">{messages.data.map((message: Message) => {
          const own = message.senderId === user?.id;
          return <article key={message.id} className={`message-bubble ${own ? 'message-own' : ''}`} data-testid={`message-${message.id}`}><div className="message-sender">{own ? 'Eu' : message.senderName || 'Pessoa da conversa'}</div><p>{message.content}</p><time>{fullDateText(message.createdAt)}</time></article>;
        })}</div> : <div className="conversation-empty"><span className="empty-icon"><Mail size={22} /></span><h3>Esta conversa ainda não começou</h3><p>Envie uma mensagem para combinar os detalhes do trabalho.</p></div>}
      </div>
      <form className="message-compose" onSubmit={submit}>{error && <Notice>{error}</Notice>}<label className="sr-only" htmlFor="message-content">A sua mensagem</label><textarea id="message-content" value={content} onChange={(event) => setContent(event.target.value)} maxLength={2000} rows={2} placeholder="Escreva uma mensagem…" data-testid="input-message" /><button className="button button-primary" type="submit" disabled={send.isPending || !content.trim()} data-testid="button-send-message">{send.isPending ? 'A enviar…' : 'Enviar'}<Send size={16} /></button></form>
    </section>}
  </main></Shell></Protected>;
}

function SignInPage() {
  return <div className="auth-page"><Link className="auth-brand" href="/"><Brand /></Link><div className="auth-aside"><span className="eyebrow eyebrow-light">Desenrasca em Estremoz</span><h1>A ajuda certa<br />está mais perto.</h1><p>Uma comunidade local para os trabalhos que tornam o dia mais fácil.</p><div className="auth-aside-mark"><ArrowDownLeft size={34} /></div></div><div className="auth-form-side"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div>;
}
function SignUpPage() {
  return <div className="auth-page"><Link className="auth-brand" href="/"><Brand /></Link><div className="auth-aside"><span className="eyebrow eyebrow-light">A comunidade começa consigo</span><h1>Há sempre<br />uma mão por perto.</h1><p>Crie a sua conta e encontre ou ofereça ajuda na sua zona.</p><div className="auth-aside-mark"><Leaf size={31} /></div></div><div className="auth-form-side"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Home /></Show></>;
}

function ClerkCacheSync() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previous.current !== undefined && previous.current !== userId) client.clear();
      previous.current = userId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function RouterContent() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={appearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={ptPT}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}>
      <ProfileBootstrap />
      <ClerkCacheSync />
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/jobs/:jobId" component={JobDetail} />
        <Route path="/post" component={PostJob} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/applications/:applicationId/messages" component={Messages} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch>
    </QueryClientProvider>
  </ClerkProvider>;
}

function NotFound() {
  return <Shell><main className="page-wrap inner-page"><div className="state-card"><span className="state-icon"><Search size={22} /></span><h1>Esta página não está aqui.</h1><p>O endereço pode ter mudado ou já não estar disponível.</p><Link className="button button-primary" href="/">Voltar ao início <ArrowRight size={16} /></Link></div></main></Shell>;
}

function App() {
  return <WouterRouter base={basePath}><RouterContent /></WouterRouter>;
}

export default App;
