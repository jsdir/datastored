local rootKey = KEYS[1]
local childKeyPrefix = KEYS[2]
local childRelation = KEYS[3]
local includeLeaves = KEYS[4]
local maxLevels = KEYS[5]

function loadTree (key,level)
  local data = {}
  local res = redis.call('lrange',key,0,-1)

  for id in res do
    local instance = {id=id}

    -- Fetch instance attributes if requested.
    if next(ARGS) != nil then
      instance.data = redis.call('hgetall',key,ARGS)
    end

    if level == 0 or level < maxLevels
      childKey = childKeyPrefix .. id
      instance.children = loadTree(childKey,level + 1)
    end
    -- TODO: strip leaves if requested
  end

  return data
end

return loadTree(rootKey,1)
