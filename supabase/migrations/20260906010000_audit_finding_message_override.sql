-- audit_finding.message_override : texte édité par le collaborateur, affiché à la place de "message"
-- quand renseigné. Le système ne le touche jamais (contrairement à "message", régénéré à chaque redétection).

ALTER TABLE audit_finding
  ADD COLUMN message_override TEXT;
