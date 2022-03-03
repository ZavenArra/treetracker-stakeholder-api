CREATE FUNCTION getStakeholderChildren
(
  uuid
)
RETURNS TABLE (stakeholder_id uuid, parent_id uuid, depth int, relations_type text, relations_role text)
AS $$
WITH RECURSIVE children AS (
   SELECT stakeholder.id, stakeholder_relations.parent_id, 1 as depth, stakeholder_relations.type, stakeholder_relations.role
   FROM stakeholder
   LEFT JOIN stakeholder_relations ON stakeholder_relations.child_id = stakeholder.id 
   WHERE stakeholder.id = $1
  UNION
   SELECT next_child.id, stakeholder_relations.parent_id, depth + 1, stakeholder_relations.type, stakeholder_relations.role
   FROM stakeholder next_child
   JOIN stakeholder_relations ON stakeholder_relations.child_id = next_child.id 
   JOIN children c ON stakeholder_relations.parent_id = c.id
)
SELECT *
FROM children
$$
LANGUAGE SQL;
