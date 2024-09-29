import { createClient } from '../../utils/supabase/server';
import { RateLimit } from "async-sema";

const limit = RateLimit(4);

async function refresh_access_token(prev_refresh_token, manga_client_id, manga_client_secret) {
    const url =
        "https://auth.mangadex.org/realms/mangadex/protocol/openid-connect/token";
    const data = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: prev_refresh_token.toString(),
        client_id: manga_client_id,
        client_secret: manga_client_secret,
    });
    // console.log("REF:", prev_refresh_token);
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: data,
        })
        if (!response.ok) {
            console.log("DTA:", data);
            console.log("RES:", response);
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const raw_data = await response.json();
        return [raw_data["access_token"], raw_data["refresh_token"]];

    } catch (error) {
        console.log("Error:", error);
        console.log("NO GO");
        return;
    }
};

async function write_tokens(user_id, access_token, refresh_token) {
    const supabase = createClient();
    const { error } = await supabase
        .from('token_info')
        .update({
            mangadex_access: access_token,
            mangadex_refresh: refresh_token
        })
        .eq('user', user_id);
    console.log("Write error:", error)
}

async function get_manga_info(access_token, offset = 0) {
    try {
        const url = "https://api.mangadex.org/user/follows/manga";
        const params = new URLSearchParams({ "limit": 50, "includes[]": "cover_art", "offset": offset })
        const response = await fetch((url + "?" + params).toString(), {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${access_token}`,
            },
        })
        if (!response.ok) {
            throw new Error("Getting Manga Info failed:", response);
        }
        const raw_data = await response.json();
        // console.log("RAW:", raw_data);
        return [raw_data["data"], raw_data["total"] - (raw_data["limit"] + raw_data["offset"])];
    } catch (error) {
        console.log("Error Get_manga_info:", error);
    }
}

async function has_unread_chapter(access_token, manga_id) {
    // Getting the latest English chapter id for the specified manga
    var latest_chapter_id;
    var read_chapter_ids;
    try {
        const url = `https://api.mangadex.org/manga/${manga_id}/feed`;
        const params = new URLSearchParams({ "order[chapter]": "desc", "translatedLanguage[]": "en" })
        const response = await fetch((url + "?" + params).toString(), {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${access_token}`,
            },
        })
        if (!response.ok) {
            throw new Error("Getting Manga Latest Chapter failed:", response);
        }
        const raw_data = await response.json();
        if (raw_data["data"].length == 0) {
            console.log("No chapters for:", manga_id);
            return null;
        } else if (!Object.keys(raw_data["data"][0]).includes("id")) {
            console.log("No chapters for:", manga_id);
            return null;
        } else {
            latest_chapter_id = raw_data["data"][0]["id"];
        }
    } catch (error) {
        console.log("Error manga latest chapter:", error);
    }

    // Getting all the chapter ids that I have read for the specific manga
    try {
        const url = `https://api.mangadex.org/manga/${manga_id}/read`;
        const params = new URLSearchParams({ "order[chapter]": "desc", "translatedLanguage[]": "en" })
        const response = await fetch((url + "?" + params).toString(), {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${access_token}`,
            },
        })
        if (!response.ok) {
            throw new Error("Getting Manga Chapter Read list failed:", response);
        }
        const raw_data = await response.json();
        read_chapter_ids = raw_data["data"];
    } catch (error) {
        console.log("Error Chapter read list:", error);
    }

    console.log("LTCH:", latest_chapter_id);
    // Checking if latest chapter id inside of chapter read list
    if (read_chapter_ids.includes(latest_chapter_id)) {
        return null;
    } else {
        return manga_id;
    }
}

async function get_unread_mangas(access_token, total_matched_manga) {
    var manga_id_lst = Object.keys(total_matched_manga);
    var unread_manga_ids_filenames = [];

    let unread;
    for (const manga_id of manga_id_lst) {
        await limit();
        unread = await has_unread_chapter(access_token, manga_id);
        if (unread != null) {
            unread_manga_ids_filenames.push([unread, total_matched_manga[manga_id][0], total_matched_manga[manga_id][1]]);
        }
    }
    console.log("UNREAD:", unread_manga_ids_filenames);
    return unread_manga_ids_filenames;
}

async function write_unread(manga_id_filename_lst) {
    const supabase = createClient();
    var { data, error } = await supabase
        .from('manga_info')
        .select()
    // Below is applied to ALL entries
    for (const entry_idx in data) {
        let manga_entry = data[entry_idx];
        ({ error } = await supabase
            .from('manga_info')
            .update({ read_latest_chapter: true })
            .eq('manga_id', manga_entry["manga_id"])
        );
        if (error) {
            console.log("Error Resetting:", error);
        }
        console.log(`Set ${manga_entry["manga_id"]} read latest to TRUE`)
    }
    // Below is applied only to manga that have unread latest chapter
    var items_to_upsert = []
    manga_id_filename_lst.forEach(manga_info => {
        items_to_upsert.push({
            "manga_id": manga_info[0],
            "read_latest_chapter": false,
            "manga_title": manga_info[1],
            "manga_cover_art": manga_info[2]
        })
        console.log(`Set id ${manga_info[0]} read latest to FALSE`)
    });

    ({ data, error } = await supabase
        .from('manga_info')
        .upsert(items_to_upsert, { onConflict: 'manga_id' })
    );

    console.log("Data:", data);
    console.log("Error Adding:", error);
}

const filter_manga_info = (total_data) => {
    var manga_match = {};
    total_data.forEach(element => {
        let manga_languages = Object.keys(element["attributes"]["title"]);
        let manga_relationships = element["relationships"];
        var cover_filename;
        for (const relationship of manga_relationships) {
            if (relationship["type"] == "cover_art") {
                cover_filename = relationship["attributes"]["fileName"];
            }
        }
        if (manga_languages.includes("en")) {
            manga_match[element["id"]] = [element["attributes"]["title"]["en"], cover_filename];
        } else {
            manga_match[element["id"]] = [element["attributes"]["title"][manga_languages[0]], cover_filename];
        }
    });
    return manga_match;
}



// export async function GET(req) {
//     try {
//         await performTask(req);
//         // task was successful, respond with 200
//         return Response.json({ status: 200 });
//     } catch (err) {
//         // task failed, respond with 500 so Mergent will retry
//         return Response.json({ status: 500 });
//     }
// }

export async function POST(req) {
    try {
        const task_message = await performTask();
        // const task_message = "Would never do that";
        // task was successful, respond with 200
        return Response.json({ status: 200, message: task_message });
    } catch (err) {
        // task failed, respond with 500 so Mergent will retry
        const task_message = "Would definitely do that";
        return Response.json({ status: 500, message: err });
    }
}

async function performTask() {
    // This is where you'll perform your task.
    // For now, we'll just log it.
    //  // changed capitalization of authorization. Was originally lowercase
    //   const authHeader = req.headers.get('Authorization');
    //     if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    //         return new Response('Unauthorized', {
    //             status: 401,
    //           });
    //       }
    const user_id = "cf7db398-d339-4948-9a18-f7643d9a4c56";
    const supabase = createClient();
    const { data, error } = await supabase
        .from('token_info')
        .select()
    var token_info = data[0];
    var saved_access = token_info.mangadex_access;
    var saved_refresh = token_info.mangadex_refresh;
    var mangadex_cl_id = token_info.mangadex_client_id;
    var mangadex_cl_sec = token_info.mangadex_client_secret;
    await limit();
    var [access_token, refresh_token] = await refresh_access_token(saved_refresh, mangadex_cl_id, mangadex_cl_sec);
    write_tokens(user_id, access_token, refresh_token);
    // =======  TEMP START  =======
    // var access_token = saved_access;
    // =======  TEMP END  =======
    await limit();
    var [unfiltered_manga_data, manga_left] = await get_manga_info(access_token);

    let req_cntr = 1;
    const req_limit = 50;

    while (manga_left > 0) {
        if (manga_left <= 0) {
            break;
        }
        let curr_unfiltered_manga;
        await limit();
        [curr_unfiltered_manga, manga_left] = await get_manga_info(access_token, req_limit * req_cntr);
        req_cntr += 1;
        unfiltered_manga_data = unfiltered_manga_data.concat(curr_unfiltered_manga);
        console.log("LEFT:", manga_left);
    }
    // key is the manga id, value is the manga title
    var manga_info_matched = filter_manga_info(unfiltered_manga_data);
    await limit();
    var unread_manga_ids_filenames = await get_unread_mangas(access_token, manga_info_matched);
    console.log("Unread mangas:", unread_manga_ids_filenames);
    console.log("Total Unread:", unread_manga_ids_filenames.length);

    await write_unread(unread_manga_ids_filenames);

    // console.log("Performing task: ", req.body);
    return "DID it ALL";
}
