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

  async verifyById(orgId, id) {
    const stakeholder = await this._session
      .getDB()(this._tableName)
      .select('*')
      .where('id', id)
      .first();

    return stakeholder;
  }

  async getAllStakeholderTrees(options) {
    // get only non-children to start building trees
    const results = await this._session
      .getDB()('stakeholder as s')
      .select('s.*')
      .leftJoin('stakeholder_relations as sr', 's.id', 'sr.child_id')
      .whereNull('sr.child_id')
      // .orWhereNull('s.owner_id')
      .orderBy('s.org_name', 'asc')
      .limit(options.limit)
      .offset(options.offset);

    const stakeholders = await Promise.all(
      results.map(async (stakeholder) => {
        // eslint-disable-next-line no-param-reassign
        stakeholder.parents = await this.getParents(stakeholder, options);
        // eslint-disable-next-line no-param-reassign
        stakeholder.children = await this.getChildren(stakeholder, options);
        return stakeholder;
      }),
    );

    const count = await this._session.getDB()('stakeholder as s').count('*');
    // .leftJoin('stakeholder_relations as sr', 's.id', 'sr.child_id')
    // .whereNull('sr.child_id');

    return { stakeholders, count: +count[0].count };
  }

  async getAllStakeholderTreesById(id = null, options) {
    // get only non-children to start building trees
    const results = await this._session
      .getDB()('stakeholder as s')
      .select('s.*')
      .leftJoin('stakeholder_relations as sr', 's.id', 'sr.child_id')
      .where('s.id', id)
      .orWhere('s.owner_id', id)
      .andWhere('sr.child_id', null)
      .orderBy('s.org_name', 'asc')
      .limit(options.limit)
      .offset(options.offset);

    const stakeholders = await Promise.all(
      results.map(async (stakeholder) => {
        // eslint-disable-next-line no-param-reassign
        stakeholder.parents = await this.getParents(stakeholder, options);
        // eslint-disable-next-line no-param-reassign
        stakeholder.children = await this.getChildren(stakeholder, options);
        return stakeholder;
      }),
    );

    // count all the stakeholder whether parent or child?
    const count = await this._session
      .getDB()(this._tableName)
      .count('*')
      .where('id', id)
      .orWhere('owner_id', id);

    return { stakeholders, count: +count[0].count };
  }

  // currently unused
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

  async getParents(child, options) {
    const parentIds = await this.getParentIds(child.id);

    if (parentIds.length) {
      const parents = await this._session
        .getDB()(this._tableName)
        .select('*')
        .whereIn('id', parentIds)
        .orderBy('org_name', 'asc')
        .limit(options.limit)
        .offset(options.offset);

      // don't want to keep getting all of the parents and children recursively, but do want to
      // include the current stakeholder as child
      return parents.map((parent) => {
        // eslint-disable-next-line no-param-reassign
        parent.parents = [];
        // eslint-disable-next-line no-param-reassign
        parent.children = [{ ...child }];
        return parent;
      });
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

  async getChildren(parent, options) {
    const childrenIds = await this.getChildrenIds(parent.id);
    const childrenFound = [...new Set(childrenIds)];

    if (childrenIds.length) {
      const children = await this._session
        .getDB()(this._tableName)
        .select('*')
        .whereIn('id', childrenFound)
        .orderBy('org_name', 'asc')
        .limit(options.limit)
        .offset(options.offset);

      // don't want to keep getting all of the parents and children recursively, but do want to
      // include the current stakeholder as parent
      return children.map((child) => {
        // eslint-disable-next-line no-param-reassign
        child.parents = [{ ...parent }];
        // eslint-disable-next-line no-param-reassign
        child.children = [];
        return child;
      });
    }
    return [];
  }

  async getFilter(filter, options) {
    // const { org_name, first_name, last_name, email, phone, ...otherFilters } =
    //   filter;

    const results = await this._session
      .getDB()(this._tableName)
      .select('*')
      .where({ ...filter })
      // .where((builder) =>
      //   org_name || first_name || last_name
      //     ? builder
      //         .where({ ...otherFilters })
      //         .orWhere('org_name', 'like', org_name)
      //         .orWhere('first_name', 'like', first_name)
      //         .orWhere('last_name', 'like', last_name)
      //     : builder.where({ ...otherFilters }),
      // )
      .orderBy('org_name', 'asc')
      .limit(options.limit)
      .offset(options.offset);

    const stakeholders = await Promise.all(
      results.map(async (stakeholder) => {
        // eslint-disable-next-line no-param-reassign
        stakeholder.parents = await this.getParents(stakeholder, options);
        // eslint-disable-next-line no-param-reassign
        stakeholder.children = await this.getChildren(stakeholder, options);
        return stakeholder;
      }),
    );

    const count = await this._session
      .getDB()(this._tableName)
      .count('*')
      .where({ ...filter });

    return { stakeholders, count: +count[0].count };
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

    const ids = new Set();
    relatedIds.forEach((stakeholder) => {
      ids.add(stakeholder.parent_id);
      ids.add(stakeholder.child_id);
    });

    return Array.from(ids);
  }

  async getFilterById(id, filter, options) {
    const relatedIds = await this.getRelatedIds(id);

    const results = await this._session
      .getDB()(this._tableName)
      .select('*')
      .where((builder) =>
        builder.whereIn('id', relatedIds).orWhere('owner_id', id),
      )
      .andWhere({ ...filter })
      .orderBy('org_name', 'asc')
      .limit(options.limit)
      .offset(options.offset);

    const stakeholders = await Promise.all(
      results.map(async (stakeholder) => {
        // eslint-disable-next-line no-param-reassign
        stakeholder.parents = await this.getParents(stakeholder.id);
        // eslint-disable-next-line no-param-reassign
        stakeholder.children = await this.getChildren(stakeholder, options);
        return stakeholder;
      }),
    );

    const count = await this._session
      .getDB()(this._tableName)
      .count('*')
      .where((builder) =>
        builder.whereIn('id', relatedIds).orWhere('owner_id', id),
      )
      .andWhere({ ...filter });

    return { stakeholders, count: +count[0].count };
  }

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

  async updateStakeholder(id, object) {
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

  async getUnlinked(id, stakeholder_id) {
    const relatedIds = await this.getRelatedIds(stakeholder_id);
    const ids = relatedIds || [];

    const stakeholders = await this._session
      .getDB()(this._tableName)
      .select('*')
      // .where('owner_id', id) // include all w/ same owner
      // .orWhere('owner_id', stakeholder_id) // include their own children
      .whereNotIn('id', [...ids, stakeholder_id]) // exclude already linked
      .orderBy('org_name', 'asc');

    const count = await this._session
      .getDB()(this._tableName)
      .count('*')
      // .where('owner_id', id)
      // .orWhere('owner_id', stakeholder_id)
      .whereNotIn('id', [...ids, stakeholder_id]);

    return { stakeholders, count: +count[0].count };
  }

  async updateLink(stakeholder_id, { type, linked, data }) {
    let linkedStakeholders;

    if (linked) {
      // to link
      const insertObj = {};

      if (type === 'parents' || type === 'children') {
        insertObj.parent_id = type === 'parents' ? data.id : stakeholder_id;
        insertObj.child_id = type === 'children' ? data.id : stakeholder_id;
      }
      // need to update db relation table before implementing
      // insertObj.grower_id = type === 'growers' ? id : null;
      // insertObj.user_id = type === 'users' ? id : null;

      linkedStakeholders = await this._session
        .getDB()('stakeholder_relations')
        .insert(insertObj)
        .returning('*');

      expect(linkedStakeholders[0]).to.have.property('parent_id');
    } else {
      // to unlink
      const removeObj = {};

      if (type === 'parents' || type === 'children') {
        removeObj.parent_id = type === 'parents' ? data.id : stakeholder_id;
        removeObj.child_id = type === 'children' ? data.id : stakeholder_id;
      }

      linkedStakeholders = await this._session
        .getDB()('stakeholder_relations')
        .where(removeObj)
        .del()
        .returning('*');

      expect(linkedStakeholders).to.match([
        {
          parent_id: expect.anything(),
        },
      ]);
    }

    return linkedStakeholders[0];
  }
}

module.exports = StakeholderRepository;
