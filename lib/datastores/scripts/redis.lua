local rootKey = KEYS[1]
local childKeyspace = KEYS[2]
local childrenAttribute = KEYS[3]

local function toJSON(e)
  local t = type (e);
  if t == "boolean" then
    if e then
      return "true"
    else
      return "false"
    end
  elseif t == "string" then
    return '"' .. e .. '"'; --[[escaping e]]
  elseif t == "number" then
    return '' .. e;
  elseif t == "table" then
    local justNum = true;
    local expected = 1;
    table.foreach(e, function(k,v)
      if k==expected then
        expected = expected+1;
      else
        justNum = false;
      end
    end)
    if justNum then
      local text = '[';
      local sep = '';
      table.foreach(e, function(k,v)
        text = text  .. sep .. toJSON(v);
        sep = ',';
      end)
      return text .. ']';
    else
      local text = '{';
      local sep = '';
      table.foreach(e, function(k,v)
        text = text  .. sep .. '"'..  k .. '":' .. toJSON(v);--[[escaping k]]
        sep = ',';
      end)
      return text .. '}';
    end
  end
end

local function slice(arr,from)
  local part = {};
  table.foreach(arr,function (k,v)
    if from <= k then
      table.insert(part,v);
    end
  end)
  return part;
end

local function map(foo,arr)
  local mapped = {};
  table.foreach(arr, function(k,v)
    table.insert(mapped,foo(v));
  end)
  return mapped;
end

local function loadTree(key,level)
  local data = {}
  local res = redis.call('lrange',key,0,-1)

  for i, id in ipairs(res) do
    local instance = {i=id}
    local childKey = childKeyspace .. ";" .. id .. ";" .. childrenAttribute
    instance.c = loadTree(childKey,level + 1)

    table.insert(data,instance)
  end

  return data
end

return toJSON(loadTree(rootKey,1))
