function publicUser(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    email: row.email,
    username: row.username,
    profilePicture: row.profile_picture,
    role: row.role,
    createdAt: row.created_at
  };
}

function mapItem(row, currentUserId) {
  return {
    id: Number(row.id),
    reportType: row.report_type,
    title: row.title,
    description: row.description,
    category: row.category,
    location: row.location,
    incidentDate: row.incident_date,
    imagePath: row.image_path,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    owner: {
      id: Number(row.user_id),
      username: row.username,
      profilePicture: row.profile_picture,
      role: row.role
    },
    isOwner: currentUserId ? Number(row.user_id) === Number(currentUserId) : false
  };
}

module.exports = { publicUser, mapItem };
