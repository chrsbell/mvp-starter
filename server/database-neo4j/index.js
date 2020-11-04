const neo4j = require('neo4j-driver');
const { user, password } = require('./credentials.js');

const driver = neo4j.driver('bolt://localhost:7687', neo4j.auth.basic(user, password));

const closeDriver = async () => {
  await driver.close();
};

// add/update an anime to the database
const addAnime = async (data) => {
  let session = driver.session({
    database: 'anilist',
  });
  try {
    const res = await session.run(
      `MERGE (a:Anime {title : $title})
       ON CREATE SET a = {title : $title, rank: $rank, main_picture: $main_picture}
       ON MATCH SET a += {rank: $rank, main_picture: $main_picture}
       RETURN a.title as title, a.rank as rank, a.main_picture as main_picture`,
      {
        title: data.node.title,
        rank: data.ranking.rank,
        main_picture: data.node.main_picture.medium,
      }
    );
    res.records.forEach((record) => {
      console.log('Inserted record: ');
      console.table([record.get('title'), record.get('rank'), record.get('main_picture')]);
    });
    await session.close();
  } catch (err) {
    console.log(err);
    await session.close();
  }
};

// add/update user to db
const addUser = async (data) => {
  debugger;
  let session = driver.session({
    database: 'anilist',
  });
  try {
    const res = await session.run(
      `MERGE (u:User {name : $name, joined_at: $joined_at, picture: $picture}) RETURN u.name as name`,
      {
        name: data.name.toLowerCase(),
        joined_at: data.joined_at,
        picture: data.picture,
      }
    );
    res.records.forEach((record) => {
      console.log(record.get('name'));
    });
    await session.close();
  } catch (err) {
    console.error(err);
    await session.close();
  }
};

// add/update user's anime list to the database as relation
const addUserAnime = async (name, data) => {
  let session = driver.session({
    database: 'anilist',
  });
  try {
    res = await session.run(
      `
      MATCH (u:User {name: $name})
      MERGE (a:Anime {title : $title}) // add/update the anime if necessary
      ON MATCH SET a += {rank: $rank, main_picture: $main_picture}
      MERGE (u)-[r:WATCHED {user_rating: $user_rating, num_episodes_watched: $num_episodes_watched}]->(a) RETURN r`, // add/update the relationship
      {
        name: name.toLowerCase(),
        main_picture: data.node.main_picture.medium,
        title: data.node.title,
        rank: data.node.rank,
        user_rating: data.list_status.score,
        num_episodes_watched: data.list_status.num_episodes_watched,
      }
    );
    res.records.forEach((record) => {
      console.log('Added relation:');
      console.log(record.get('r'));
    });
    await session.close();
  } catch (err) {
    console.error(err);
    await session.close();
  }
};

const findAnimeInCommon = async (name) => {
  let session = driver.session({
    database: 'anilist',
  });
  try {
    // match all patterns up to two nodes deep
    const res = await session.run(
      `MATCH p = (u:User)-[*..2]->(a:Anime)<-[*..2]-(b:User) WITH *, relationships(p) as userStats WHERE u.name=$name RETURN a AS anime, b AS friend, userStats`,
      {
        name: name.toLowerCase(),
      }
    );
    /*
      {
        username: {
          userInfo: {
            joined_at: String,
            name: String,
            picture: String,
          }
          animeInCommon: 7,
          anime: [{
              animeInfo: {},
              myStats: {},
              friendStats: {},
          }]
        }
      }

    */
    console.log('Found shared anime:');
    console.table(res.records);
    let commonalities = {};
    res.records.forEach((record) => {
      let userStats = record.get('userStats');
      let user = record.get('friend').properties;
      let animeRecord = {
        animeInfo: record.get('anime').properties,
        myStats: userStats[0].properties,
        friendStats: userStats[1].properties,
      };
      if (commonalities[user.name] === undefined) {
        commonalities[user.name] = {
          userInfo: user,
          animeInCommon: 1,
          anime: [animeRecord],
        };
      } else {
        commonalities[user.name].animeInCommon += 1;
        commonalities[user.name].anime.push(animeRecord);
      }
    });

    await session.close();
    // return closest connections first
    return Object.entries(commonalities).sort((a, b) => {
      return b[1].animeInCommon - a[1].animeInCommon;
    });
  } catch (err) {
    console.error(err);
    await session.close();
  }
};

module.exports = {
  closeDriver,
  addAnime,
  addUser,
  addUserAnime,
  findAnimeInCommon,
};
