import { storage } from "./storage";

export type ThemeMode = "system" | "light" | "dark";

export function resolveLocale(value?: string) {
  if (!value || value === "auto") {
    return navigator.language || "en-US";
  }
  return value;
}

export function resolveTheme(theme?: ThemeMode) {
  if (!theme || theme === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return theme;
}

export async function getPreferredLanguage() {
  const data = await storage.getLocal<{ language?: string; languagePreference?: string }>([
    "language",
    "languagePreference",
  ]);
  return resolveLocale(data.languagePreference || data.language);
}

export async function applyDocumentPreferences() {
  const data = await storage.getLocal<{
    language?: string;
    languagePreference?: string;
    theme?: ThemeMode;
  }>(["language", "languagePreference", "theme"]);

  const locale = resolveLocale(data.languagePreference || data.language);
  const theme = resolveTheme(data.theme);

  document.documentElement.lang = locale;
  document.documentElement.dataset.theme = theme;
}

export function getSettingsStrings(locale?: string) {
  const normalized = resolveLocale(locale).toLowerCase();
  if (normalized.startsWith("es")) {
    return {
      title: "Configuración",
      subtitle: "Ajusta almacenamiento, tema, vista compacta e idioma.",
      useSync: "Usar almacenamiento sincronizado",
      useEncryption: "Usar encriptación",
      compactMode: "Modo compacto",
      theme: "Tema",
      language: "Idioma",
      save: "Guardar",
      reset: "Restablecer",
      system: "Sistema",
      light: "Claro",
      dark: "Oscuro",
    };
  }
  if (normalized.startsWith("pt")) {
    return {
      title: "Configurações",
      subtitle: "Ajuste armazenamento, tema, modo compacto e idioma.",
      useSync: "Usar armazenamento sincronizado",
      useEncryption: "Usar criptografia",
      compactMode: "Modo compacto",
      theme: "Tema",
      language: "Idioma",
      save: "Salvar",
      reset: "Redefinir",
      system: "Sistema",
      light: "Claro",
      dark: "Escuro",
    };
  }
  return {
    title: "Settings",
    subtitle: "Tune storage, theme, compactness, and language in one place.",
    useSync: "Use sync storage",
    useEncryption: "Use encryption",
    compactMode: "Compact mode",
    theme: "Theme",
    language: "Language",
    save: "Save",
    reset: "Reset",
    system: "System",
    light: "Light",
    dark: "Dark",
  };
}

export function getUiStrings(locale?: string) {
  const normalized = resolveLocale(locale).toLowerCase();
  if (normalized.startsWith("es")) {
    return {
      navPins: "Pines",
      navProfile: "Perfil",
      navSettings: "Configuración",
      popupEyebrow: "Panel",
      popupSubtitle: "Guarda la página actual, importa pestañas fijadas y organiza tu contexto personal.",
      profileEyebrow: "Cuenta",
      profileTitle: "Perfil",
      profileSubtitle: "Actualiza preferencias y gestiona tu suscripción.",
      authEyebrow: "Autenticación",
      authSubtitle: "Inicia sesión, crea una cuenta o recupera el acceso.",
      teamsEyebrow: "Equipos",
      teamsTitle: "Gestionar equipo",
      teamsSubtitle: "Controles solo para propietarios de miembros, invitaciones y ajustes del equipo.",
      signedIn: "Sesión iniciada",
      checkingSession: "Comprobando sesión…",
      workspace: "Espacio de trabajo",
      teamContext: "Contexto de equipo",
      personalContext: "Contexto personal",
      personal: "Personal",
      memberMode: "Modo miembro: solo puedes ver pines del equipo.",
      openTeamManage: "Abrir gestión de equipo (nueva pestaña)",
      teamInvites: "Invitaciones de equipo",
      pending: "pendientes",
      team: "Equipo",
      accept: "Aceptar",
      decline: "Rechazar",
      quickActions: "Acciones rápidas",
      teamOperations: "Operaciones de equipo",
      personalOperations: "Operaciones personales",
      pinCurrentTab: "Fijar pestaña actual",
      importPinnedTabs: "Importar pestañas fijadas",
      tagsPlaceholder: "Etiquetas (separadas por comas)",
      filterPinsPlaceholder: "Filtrar pines...",
      noPinsFound: "No se encontraron pines.",
      remove: "Eliminar",
      noTags: "Sin etiquetas",
      tagsSuffix: "etiquetas",
      logout: "Cerrar sesión",
      unknownSource: "Origen desconocido",
      onlyOwnersPin: "Solo los propietarios de equipo pueden fijar páginas del equipo",
      noActiveTab: "No se encontró pestaña activa",
      pinnedCurrentTab: "Pestaña actual fijada",
      noBrowserPinnedTabs: "No se encontraron pestañas fijadas en el navegador",
      importedPinnedTabs: "Se importaron {count} pestaña(s) fijada(s).",
      onlyOwnersDelete: "Solo los propietarios de equipo pueden eliminar pines del equipo",
      failedDeletePin: "No se pudo eliminar el pin",
      pinRemoved: "Pin eliminado",
      failedInviteAction: "No se pudo {action} la invitación",
      inviteAccepted: "Invitación aceptada",
      inviteDeclined: "Invitación rechazada",
    };
  }
  if (normalized.startsWith("pt")) {
    return {
      navPins: "Pins",
      navProfile: "Perfil",
      navSettings: "Configurações",
      popupEyebrow: "Painel",
      popupSubtitle: "Salve a página atual, importe abas fixadas e organize seu contexto pessoal.",
      profileEyebrow: "Conta",
      profileTitle: "Perfil",
      profileSubtitle: "Atualize preferências e gerencie sua assinatura.",
      authEyebrow: "Autenticação",
      authSubtitle: "Entre, crie uma conta ou recupere o acesso.",
      teamsEyebrow: "Equipes",
      teamsTitle: "Gerenciar equipe",
      teamsSubtitle: "Controles apenas para proprietários de membros, convites e configurações da equipe.",
      signedIn: "Sessão iniciada",
      checkingSession: "Verificando sessão…",
      workspace: "Espaço de trabalho",
      teamContext: "Contexto de equipe",
      personalContext: "Contexto pessoal",
      personal: "Pessoal",
      memberMode: "Modo membro: você só pode ver pins da equipe.",
      openTeamManage: "Abrir gestão de equipe (nova guia)",
      teamInvites: "Convites de equipe",
      pending: "pendentes",
      team: "Equipe",
      accept: "Aceitar",
      decline: "Recusar",
      quickActions: "Ações rápidas",
      teamOperations: "Operações de equipe",
      personalOperations: "Operações pessoais",
      pinCurrentTab: "Fixar aba atual",
      importPinnedTabs: "Importar abas fixadas",
      tagsPlaceholder: "Tags (separadas por vírgula)",
      filterPinsPlaceholder: "Filtrar pins...",
      noPinsFound: "Nenhum pin encontrado.",
      remove: "Remover",
      noTags: "Sem tags",
      tagsSuffix: "tags",
      logout: "Sair",
      unknownSource: "Origem desconhecida",
      onlyOwnersPin: "Apenas donos da equipe podem fixar páginas da equipe",
      noActiveTab: "Nenhuma aba ativa encontrada",
      pinnedCurrentTab: "Aba atual fixada",
      noBrowserPinnedTabs: "Nenhuma aba fixada do navegador encontrada",
      importedPinnedTabs: "Importadas {count} aba(s) fixada(s).",
      onlyOwnersDelete: "Apenas donos da equipe podem excluir pins da equipe",
      failedDeletePin: "Falha ao excluir pin",
      pinRemoved: "Pin removido",
      failedInviteAction: "Falha ao {action} convite",
      inviteAccepted: "Convite aceito",
      inviteDeclined: "Convite recusado",
    };
  }
  return {
    navPins: "Pins",
    navProfile: "Profile",
    navSettings: "Settings",
    popupEyebrow: "Dashboard",
    popupSubtitle: "Save the current page, import pinned tabs, and keep your personal context organized.",
    profileEyebrow: "Account",
    profileTitle: "Profile",
    profileSubtitle: "Update preferences, manage subscriptions, and keep billing in sync.",
    authEyebrow: "Authentication",
    authSubtitle: "Sign in, create an account, or recover access with a clean, fast flow.",
    teamsEyebrow: "Teams",
    teamsTitle: "Manage Team",
    teamsSubtitle: "Owner-only controls for team members, invites, and team settings in this browser tab.",
    signedIn: "Signed in",
    checkingSession: "Checking session…",
    workspace: "Workspace",
    teamContext: "Team context",
    personalContext: "Personal context",
    personal: "Personal",
    memberMode: "Member mode: you can view team pins only.",
    openTeamManage: "Open Team Manage (new tab)",
    teamInvites: "Team invites",
    pending: "pending",
    team: "Team",
    accept: "Accept",
    decline: "Decline",
    quickActions: "Quick actions",
    teamOperations: "Team operations",
    personalOperations: "Personal operations",
    pinCurrentTab: "Pin current tab",
    importPinnedTabs: "Import pinned tabs",
    tagsPlaceholder: "Tags (comma-separated)",
    filterPinsPlaceholder: "Filter pins...",
    noPinsFound: "No pins found.",
    remove: "Remove",
    noTags: "No tags",
    tagsSuffix: "tags",
    logout: "Log out",
    unknownSource: "Unknown source",
    onlyOwnersPin: "Only team owners can pin team pages",
    noActiveTab: "No active tab found",
    pinnedCurrentTab: "Pinned current tab",
    noBrowserPinnedTabs: "No pinned browser tabs found",
    importedPinnedTabs: "Imported {count} pinned tab(s).",
    onlyOwnersDelete: "Only team owners can delete team pins",
    failedDeletePin: "Failed to delete pin",
    pinRemoved: "Pin removed",
    failedInviteAction: "Failed to {action} invite",
    inviteAccepted: "Invite accepted",
    inviteDeclined: "Invite declined",
  };
}
