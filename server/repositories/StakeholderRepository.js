const expect = require('expect-runtime');
const BaseRepository = require('./BaseRepository');

class StakeholderRepository extends BaseRepository {
  constructor(session) {
    super('stakeholder', session);
    this._tableName = 'stakeholder';
    this._session = session;
  }

  // RETURNS A FLAT LIST OF RELATED ORGS FROM OLD TABLE
  async getStakeholderByOrganizationId(organization_id, options) {
    const result = await this._session
      .getDB()
      .raw(
        'select * from entity where id in (select entity_id from getEntityRelationshipChildren(?)) limit ? offset ?',
        [organization_id, options.limit, options.offset],
      );

    const count = await this._session
      .getDB()
      .raw(
        'select count(*) from entity where id in (select entity_id from getEntityRelationshipChildren(?))',
        [organization_id],
      );

    // console.log('get by organization id ------> ', result.rows);

    return { stakeholders: result.rows, count: +count.rows[0].count };
  }

  async getUUIDbyId(id) {
    const stakeholder_id = await this._session
      .getDB()(this._tableName)
      .select('id')
      .where('organization_id', id)
      .first();

    return stakeholder_id;
  }

  async verifyById(id) {
    const stakeholder = await this._session
      .getDB()(this._tableName)
      .select('*')
      .where('id', id)
      .first();

    return stakeholder;
  }

  async getAllStakeholders(options) {
    // get only non-children to start building trees
    const results = await this._session
      .getDB()('stakeholder as s')
      .select('s.*')
      .leftJoin('stakeholder_relations as sr', 's.id', 'sr.child_id')
      .whereNull('sr.child_id')
      .orderBy('s.org_name', 'asc')
      .limit(Number(options.limit))
      .offset(options.offset);

    const count = await this._session.getDB()('stakeholder as s').count('*');

    // // add these lines to count only the parents and not the children:
    // .leftJoin('stakeholder_relations as sr', 's.id', 'sr.child_id')
    // .whereNull('sr.child_id');

    return { stakeholders: results, count: +count[0].count };
  }

  async getAllStakeholdersById(id = null, options) {
    // get only non-children to start building trees
    const results = await this._session
      .getDB()('stakeholder as s')
      .select('s.*')
      .leftJoin('stakeholder_relations as sr', 's.id', 'sr.child_id')
      .where('s.id', id)
      .orWhere('s.owner_id', id)
      .andWhere('sr.child_id', null)
      .orderBy('s.org_name', 'asc')
      .limit(Number(options.limit))
      .offset(options.offset);

    // count all the stakeholders, regardless of nesting
    const count = await this._session
      .getDB()(this._tableName)
      .count('*')
      .where('id', id)
      .orWhere('owner_id', id);

    return { stakeholders: results, count: +count[0].count };
  }

  // not currently being used but may be useful later
  async getStakeholderTreeById(id, options) {
    const stakeholder = await this._session
      .getDB()(this._tableName)
      .select('*')
      .where('id', id)
      .first();

    // only get one step generation difference, no recursion
    stakeholder.parents = await this.getParents(stakeholder, options);
    stakeholder.children = await this.getChildren(stakeholder, options);

    const count = await this._session
      .getDB()(this._tableName)
      .count('*')
      .where('id', id);

    return {
      stakeholders: [stakeholder],
      count: count ? +count[0].count : 0,
    };
  }

  async getParentIds(id) {
    const parents = await this._session
      .getDB()('stakeholder as s')
      .select('sr.parent_id')
      .join('stakeholder_relations as sr', 's.id', 'sr.child_id')
      .where('s.id', id);

    return parents.length ? parents.map((parent) => parent.parent_id) : [];
  }

  async getParents(child) {
    const parentIds = await this.getParentIds(child.id);

    if (parentIds.length) {
      return this._session
        .getDB()(this._tableName)
        .select('*')
        .whereIn('id', parentIds)
        .orderBy('org_name', 'asc');
    }
    return [];
  }

  async getChildrenIds(id) {
    const children = await this._session
      .getDB()('stakeholder as s')
      .select('sr.child_id')
      .join('stakeholder_relations as sr', 's.id', 'sr.parent_id')
      .where('s.id', id);

    return children.length ? children.map((child) => child.child_id) : [];
  }

  async getChildren(parent) {
    const childrenIds = await this.getChildrenIds(parent.id);
    const childrenFound = [...new Set(childrenIds)];

    if (childrenIds.length) {
      return this._session
        .getDB()(this._tableName)
        .select('*')
        .whereIn('id', childrenFound)
        .orderBy('org_name', 'asc');
    }
    return [];
  }

  async getFilter(filter, options) {
    const stakeholders = await this._session
      .getDB()(this._tableName)
      .select('*')
      .where({ ...filter })
      .orderBy('org_name', 'asc')
      .limit(Number(options.limit))
      .offset(options.offset);

    const count = await this._session
      .getDB()(this._tableName)
      .count('*')
      .where({ ...filter });

    return { stakeholders, count: +count[0].count };
  }

  async getFilterById(id, filter, options) {
    const relatedIds = await this.getRelatedIds(id);

    const stakeholders = await this._session
      .getDB()(this._tableName)
      .select('*')
      .where((builder) =>
        builder.whereIn('id', relatedIds).orWhere('owner_id', id),
      )
      .andWhere({ ...filter })
      .orderBy('org_name', 'asc')
      .limit(Number(options.limit))
      .offset(options.offset);

    const count = await this._session
      .getDB()(this._tableName)
      .count('*')
      .where((builder) =>
        builder.whereIn('id', relatedIds).orWhere('owner_id', id),
      )
      .andWhere({ ...filter });

    return { stakeholders, count: +count[0].count };
  }

  // in progress
  // async getSearch(value, options) {
  //   const stakeholders = await this._session
  //     .getDB()(this._tableName)
  //     .select('*')
  //     .whereILike('org_name', value)
  //     .orWhereILike('first_name', value)
  //     .orWhereILike('last_name', value)
  //     .orWhereILike('email', value)
  //     .orWhereILike('phone', value)
  //     .limit(options.limit)
  //     .offset(options.offset);

  //   const count = await this._session
  //     .getDB()(this._tableName)
  //     .count('*')
  //     .whereILike('org_name', value)
  //     .orWhereILike('first_name', value)
  //     .orWhereILike('last_name', value)
  //     .orWhereILike('email', value)
  //     .orWhereILike('phone', value);

  //   return { stakeholders, count: +count[0].count };
  // }

  async createStakeholder(object) {
    const created = await this._session
      .getDB()(this._tableName)
      .insert(object)
      .returning('*');

    expect(created).match([
      {
        id: expect.anything(),
      },
    ]);

    return created[0];
  }

  async updateStakeholder(object) {
    const updated = await this._session
      .getDB()(this._tableName)
      .where('id', object.id)
      .update(object, ['*']);

    expect(updated).match([
      {
        id: expect.anything(),
      },
    ]);

    return updated[0];
  }

  async getRelatedIds(id) {
    const relatedIds = await this._session
      .getDB()('stakeholder as s')
      .select('sr.child_id', 'sr.parent_id')
      .join('stakeholder_relations as sr', function () {
        this.on(function () {
          this.on('s.id', 'sr.child_id');
          this.orOn('s.id', 'sr.parent_id');
        });
      })
      .where('s.id', id);

    // get rid of duplicates
    const ids = new Set();
    relatedIds.forEach((stakeholder) => {
      ids.add(stakeholder.parent_id);
      ids.add(stakeholder.child_id);
    });

    return Array.from(ids);
  }

  async getRelations(id, owner_id) {
    const relatedIds = await this.getRelatedIds(id);
    const ids = relatedIds || [];

    const stakeholders = await this._session
      .getDB()(this._tableName)
      .select('*')
      .whereIn('owner_id', [id, owner_id])
      .orWhereNull('owner_id')
      .whereIn('id', [...ids, id])
      .orderBy('org_name', 'asc');

    const count = await this._session
      .getDB()(this._tableName)
      .count('*')
      .whereIn('id', [...ids, id]);

    return { stakeholders, count: +count[0].count };
  }

  async getNonRelations(id, owner_id) {
    const relatedIds = await this.getRelatedIds(id);
    const ids = relatedIds || [];

    const stakeholders = await this._session
      .getDB()(this._tableName)
      .select('*')
      .whereIn('owner_id', [id, owner_id])
      .orWhereNull('owner_id')
      .whereNotIn('id', [...ids, id])
      .orderBy('org_name', 'asc');

    const count = await this._session
      .getDB()(this._tableName)
      .count('*')
      .whereNotIn('id', [...ids, id]);

    return { stakeholders, count: +count[0].count };
  }

  async createRelation(stakeholder) {
    const linkedStakeholders = await this._session
      .getDB()('stakeholder_relations')
      .insert(stakeholder)
      .returning('*');

    expect(linkedStakeholders[0]).to.have.property('parent_id');

    return linkedStakeholders[0];
  }

  async deleteRelation(stakeholder) {
    const linkedStakeholders = await this._session
      .getDB()('stakeholder_relations')
      .where(stakeholder)
      .del()
      .returning('*');

    expect(linkedStakeholders).to.match([
      {
        parent_id: expect.anything(),
      },
    ]);

    return linkedStakeholders[0];
  }
}

module.exports = StakeholderRepository;
