-- =====================================================================
-- 010 — Acerto por nível conta QUESTÕES DIFERENTES, pela primeira tentativa.
-- Rode DEPOIS de 009_trilha_materiais.sql. Idempotente.
--
-- Antes, a view contava RESPOSTAS: responder a mesma questão várias vezes (revisão,
-- simulado) inflava o total e, errando e depois acertando, o acerto também. Com a
-- regra nova de desbloqueio (pelo menos 20 questões com 80% de acerto), cada questão
-- vale uma vez, e vale a primeira tentativa: é ela que mostra se a pessoa já sabia.
--
-- Mesmas colunas e tipos de antes (etapa_id, nivel, total, acertos): quem lê a view
-- (registrar_resposta, painel, trilha adaptativa) não muda.
-- =====================================================================
create or replace view v_acerto_etapa_nivel
with (security_invoker = true) as
select
    p.etapa_id,
    p.nivel,
    count(*)                         as total,
    count(*) filter (where p.correta) as acertos
from (
    select distinct on (r.exercicio_id) x.etapa_id, x.nivel, r.correta
      from respostas r
      join exercicios x on x.id = r.exercicio_id
     order by r.exercicio_id, r.created_at, r.id
) p
group by p.etapa_id, p.nivel;

grant select on v_acerto_etapa_nivel to authenticated;
