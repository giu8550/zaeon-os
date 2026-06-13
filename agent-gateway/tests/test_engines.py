"""Testes das engines de lógica pura — rodam sem nenhum serviço externo."""
from datetime import datetime, timedelta, timezone

from app.engines import brazilian_names as names
from app.engines import edu_eligibility as edu
from app.engines import plans
from app.engines import onboarding as ob


# ───────────────── gênero por nome ─────────────────
def test_seed_names_high_confidence():
    assert names.guess("João Silva").gender is names.Gender.MALE
    assert names.guess("Maria Souza").gender is names.Gender.FEMALE
    assert names.guess("João").confidence >= 0.9


def test_accents_and_case():
    assert names.guess("ÁNGELA").gender is names.Gender.FEMALE
    assert names.guess("césar").gender in (names.Gender.MALE, names.Gender.NEUTRAL)


def test_override_always_wins():
    # nome "feminino" mas a pessoa declara masculino → respeita
    a = names.resolve("Maria", user_override="ele")
    assert a.gender is names.Gender.MALE
    assert a.confidence == 1.0
    assert a.source == "override"


def test_unknown_is_neutral():
    a = names.guess("Xyzqk")
    assert a.gender is names.Gender.NEUTRAL
    assert a.treat_suffix == ""


def test_address_flexion():
    assert names.resolve("João").adj("bem-vind") == "bem-vindo"
    assert names.resolve("Maria").adj("bem-vind") == "bem-vinda"


# ───────────────── elegibilidade .edu ─────────────────
def test_known_university():
    r = edu.check("aluno@usp.br")
    assert r.eligible and r.is_brazilian
    assert "São Paulo" in (r.institution or "")


def test_subdomain_university():
    r = edu.check("fulano@aluno.ufmg.br")
    assert r.eligible and r.kind is edu.InstitutionKind.FEDERAL


def test_generic_edu_br():
    assert edu.check("x@faculdadex.edu.br").eligible


def test_federal_pattern():
    r = edu.check("a@ufxyz.br")
    assert r.eligible and r.kind is edu.InstitutionKind.FEDERAL


def test_personal_email_not_eligible():
    assert not edu.check("pessoa@gmail.com").eligible


def test_international_edu_flagged_non_br():
    r = edu.check("student@mit.edu")
    assert r.eligible and not r.is_brazilian


# ───────────────── planos ─────────────────
def test_whatsapp_is_plus_only():
    free = plans.PlanState(plan=plans.Plan.FREE)
    plus = plans.PlanState(plan=plans.Plan.PLUS)
    assert not plans.can_use(free, plans.Feature.WHATSAPP)
    assert plans.can_use(plus, plans.Feature.WHATSAPP)
    assert plans.can_use(free, plans.Feature.VOICE_IO)  # voz é dos dois


def test_student_trial_grants_plus_and_whatsapp():
    s = plans.grant_student_trial(plans.PlanState(plan=plans.Plan.FREE))
    assert s.plan is plans.Plan.PLUS and s.trial_granted
    assert plans.can_use(s, plans.Feature.WHATSAPP)


def test_trial_is_idempotent():
    s1 = plans.grant_student_trial(plans.PlanState(plan=plans.Plan.FREE))
    s2 = plans.grant_student_trial(s1)
    assert s1 == s2


def test_plus_expires():
    past = datetime.now(timezone.utc) - timedelta(days=1)
    s = plans.PlanState(plan=plans.Plan.PLUS, plus_until=past, trial_granted=True)
    assert plans.effective_plan(s) is plans.Plan.FREE
    assert not plans.can_use(s, plans.Feature.WHATSAPP)


# ───────────────── onboarding ─────────────────
def test_onboarding_student_path_offers_trial():
    ctx = ob.OnboardingContext(full_name="Maria Clara", email="maria@usp.br")
    r = ob.step(ob.Step.CHECK_EDU, ctx)
    assert r.next_step is ob.Step.OFFER_TRIAL
    assert "São Paulo" in r.message


def test_onboarding_accept_trial_enables_whatsapp():
    ctx = ob.OnboardingContext(full_name="João", email="joao@ufrj.br", accepted_trial=True)
    r = ob.step(ob.Step.OFFER_TRIAL, ctx)
    assert "grant_trial" in r.effects
    assert "enable_whatsapp" in r.effects


def test_onboarding_non_student_skips_to_rooms():
    ctx = ob.OnboardingContext(full_name="Carlos", email="carlos@gmail.com")
    r = ob.step(ob.Step.CHECK_EDU, ctx)
    assert r.next_step is ob.Step.CONNECT_ROOMS
