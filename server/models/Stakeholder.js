const { v4: uuid } = require('uuid');

const Stakeholder = ({
  id,
  type,
  name,
  first_name,
  last_name,
  email,
  phone,
  pwd_reset_required,
  website,
  wallet,
  password,
  salt,
  active_contract_id,
  offering_pay_to_plant,
  tree_validation_contract_id,
  logo_url,
  map_name,
  stakeholder_uuid,
  children,
  parents,
  users,
}) => {
  return Object.freeze({
    id,
    type,
    name,
    first_name,
    last_name,
    email,
    phone,
    pwd_reset_required,
    website,
    wallet,
    password,
    salt,
    active_contract_id,
    offering_pay_to_plant,
    tree_validation_contract_id,
    logo_url,
    map_name,
    stakeholder_uuid,
    children,
    parents,
    users,
  });
};

// const StakeholderObject = ({
//   id,
//   type,
//   name,
//   first_name,
//   last_name,
//   email,
//   phone,
//   website,
//   logo_url,
//   map_name,
//   stakeholder_uuid,
//   children,
//   parents,
//   users,
// }) =>
//   Object.freeze({
//     id,
//     type,
//     name,
//     first_name,
//     last_name,
//     email,
//     phone,
//     website,
//     logo_url,
//     map_name,
//     stakeholder_uuid,
//     children,
//     parents,
//     users,
//   });

// const createStakeholder = async (stakeholderRepo, requestBody) => {
//   const stakeholderObj = Stakeholder({ ...requestBody });
//   const stakeholder = await stakeholderRepo.create(stakeholderObj);

//   const stakeholderReqObj = Stakeholder({
//     ...stakeholder,
//   });
// };

const FilterCriteria = ({
  stakeholder_id = undefined,
  stakeholder_uuid = undefined,
  organization_id = undefined,
}) => {
  return Object.entries({
    id: stakeholder_id,
    stakeholder_uuid,
    organization_id,
  })
    .filter((entry) => entry[1] !== undefined)
    .reduce((result, item) => {
      result[item[0]] = item[1];
      return result;
    }, {});
};

const QueryOptions = ({ limit = undefined, offset = undefined }) => {
  return Object.entries({ limit, offset })
    .filter((entry) => entry[1] !== undefined)
    .reduce((result, item) => {
      result[item[0]] = item[1];
      return result;
    }, {});
};

const getStakeholders =
  (stakeholderRepo) =>
  async (filterCriteria = undefined, url) => {
    let filter = {};
    filter = FilterCriteria({
      ...filterCriteria,
    });

    let options = { limit: 100, offset: 0 };

    options = { ...options, ...QueryOptions({ ...filterCriteria }) };

    const queryFilterObjects = { ...filterCriteria };
    queryFilterObjects.limit = options.limit;

    // remove offset property, as it is calculated later
    delete queryFilterObjects.offset;

    const query = Object.keys(queryFilterObjects)
      .map((key) => `${key}=${encodeURIComponent(queryFilterObjects[key])}`)
      .join('&');

    const urlWithLimitAndOffset = `${url}?${query}&offset=`;

    const next = `${urlWithLimitAndOffset}${+options.offset + +options.limit}`;
    let prev = null;
    if (options.offset - +options.limit >= 0) {
      prev = `${urlWithLimitAndOffset}${+options.offset - +options.limit}`;
    }

    let stakeholders = [];
    let count = 0;

    if (filter.organization_id) {
      const { stakeholders: dbStakeholders, count: dbCount } =
        await stakeholderRepo.getStakeholderByOrganizationId(
          filter.organization_id,
          options,
        );
      stakeholders = dbStakeholders;
      count = dbCount;
    } else {
      const { result: dbStakeholders, count: dbCount } =
        await stakeholderRepo.getByFilter(filter, options);
      stakeholders = dbStakeholders;
      count = dbCount;
    }

    return {
      stakeholders: stakeholders.map((row) => {
        return Stakeholder({ ...row });
      }),
      totalCount: count,
      links: {
        prev,
        next,
      },
    };
  };

// const getStakeholders = (stakeholderRepo) =>
// async (filterCriteria = undefined) => {
//   console.log('STAKEHOLDER MODEL filterCriteria', filterCriteria);

//   let filter = {};
//   let options = { limit: 100, offset: 0 };

//   // filter = FilterCriteria({ ...filterCriteria });
//   // options = { ...options, ...QueryOptions({ ...filterCriteria }) };

//   const stakeholders = await stakeholderRepo.getStakeholders(filter, options);

//   return stakeholders.map((row) => {
//     return Stakeholder({ ...row });
//   });
// };

// const getStakeholderById = (stakeholderRepo) => async (id) => {
//   console.log('STAKEHOLDER MODEL id', id);

//   const stakeholder = await stakeholderRepo.getStakeholderById(id);
//   console.log('STAKEHOLDER', stakeholder);
//   return StakeholderObject(stakeholder);
// };

module.exports = {
  getStakeholders,
  Stakeholder,
  FilterCriteria,
  // createStakeholder,
};
