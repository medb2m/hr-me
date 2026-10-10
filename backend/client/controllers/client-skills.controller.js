import { Skill, skillKey } from '../../models/skill.model.js';
import { SKILL_SEED } from '../../data/skills-seed.js';

let seedPromise = null;

/** Insère la bibliothèque initiale une seule fois (idempotent, upsert par `key`). */
function ensureSeed() {
  if (!seedPromise) {
    seedPromise = (async () => {
      const count = await Skill.estimatedDocumentCount();
      if (count > 0) {
        return;
      }
      const ops = SKILL_SEED.map(([label, category, kind]) => ({
        updateOne: {
          filter: { key: skillKey(label) },
          update: {
            $setOnInsert: {
              key: skillKey(label),
              label,
              category: category || 'autre',
              kind: kind || 'skill',
              source: 'seed',
            },
          },
          upsert: true,
        },
      }));
      await Skill.bulkWrite(ops, { ordered: false });
    })().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

/** Retire les accents + minuscules pour une recherche insensible. */
function fold(q) {
  return String(q || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function skillDto(s) {
  return { label: s.label, category: s.category, kind: s.kind };
}

/**
 * GET /api/client/skill-library?q=&kind=&limit=
 * Suggestions depuis la bibliothèque : sans `q` → les plus utilisées ;
 * avec `q` → correspondance insensible casse/accents sur le libellé.
 */
export async function listSkillSuggestions(req, res) {
  try {
    await ensureSeed();
    const kind = req.query.kind === 'digital' ? 'digital' : 'skill';
    const limit = Math.min(parseInt(String(req.query.limit || ''), 10) || 20, 50);
    const q = fold(req.query.q);
    const filter = { kind };
    if (q) {
      filter.key = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') };
    }
    const skills = await Skill.find(filter)
      .sort({ count: -1, label: 1 })
      .limit(limit)
      .lean();
    return res.json({ skills: skills.map(skillDto) });
  } catch (err) {
    console.error('[client/skills] list', err);
    return res.status(500).json({ message: 'Suggestions indisponibles.' });
  }
}

/**
 * POST /api/client/skill-library/register — { label, kind? }
 * Appelé quand un utilisateur ajoute une compétence : upsert dans la
 * bibliothèque (incrémente `count`), qui « apprend » donc en continu.
 */
export async function registerSkill(req, res) {
  try {
    await ensureSeed();
    const label = String(req.body?.label || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 60);
    if (!label) {
      return res.status(400).json({ message: 'Compétence invalide.' });
    }
    const kind = req.body?.kind === 'digital' ? 'digital' : 'skill';
    const key = skillKey(label);
    const skill = await Skill.findOneAndUpdate(
      { key },
      { $inc: { count: 1 }, $setOnInsert: { key, label, kind, category: 'autre', source: 'user' } },
      { new: true, upsert: true },
    );
    return res.status(201).json({ skill: skillDto(skill) });
  } catch (err) {
    console.error('[client/skills] register', err);
    return res.status(500).json({ message: 'Enregistrement impossible.' });
  }
}
